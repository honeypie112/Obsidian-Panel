const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const auth = require('../middleware/auth');
const minecraftService = require('../services/minecraftService');
const backupService = require('../services/backupService');
const Backup = require('../models/Backup');

// In-memory lock for backup process (DEPRECATED - Use service state)
// let isBackupInProgress = false;

// @route   GET api/backups
// @desc    Get backup history
// @access  Private
// Status check
// Restore Endpoint
let isRestoreInProgress = false;

// Update status endpoint to include restore status
router.get('/status', (req, res) => {
    res.json({
        isBackupInProgress: backupService.isBackupInProgress(),
        isRestoreInProgress
    });
});

router.post('/:id/restore', auth, async (req, res) => {
    if (backupService.isBackupInProgress() || isRestoreInProgress) {
        return res.status(409).json({ message: 'A backup or restore operation is already in progress.' });
    }

    let downloadPath = null; // Defined outside try block for cleanup access

    try {
        const backup = await Backup.findById(req.params.id);
        if (!backup) return res.status(404).json({ message: 'Backup not found' });

        isRestoreInProgress = true;
        minecraftService.isOperationLocked = true; // LOCK SERVER OPERATIONS
        console.log(`Starting restore for ${backup.fileName}...`);

        // 1. Force Stop Server if running
        if (minecraftService.status !== 'offline') {
            console.log('Stopping server for restore...');
            minecraftService.stop();
            // Wait for offline (poll every 1s, max 30s)
            let retries = 30;
            while (minecraftService.status !== 'offline' && retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries--;
            }
            if (minecraftService.status !== 'offline') {
                throw new Error('Failed to stop server. Restore aborted.');
            }
        }

        // 2. Wipe Server Directory
        const serverDir = minecraftService.serverDir;
        console.log('Wiping server directory...');
        if (fs.existsSync(serverDir)) {
            fs.rmSync(serverDir, { recursive: true, force: true });
            fs.mkdirSync(serverDir, { recursive: true });
        }

        // 3. Download from GoFile (Native JS Port)
        console.log(`Starting GoFile native download for: ${backup.downloadPage}`);

        // Helper: Create Guest Account to get Token
        // Logic from gofile-downloader.py: _set_account_access_token
        // The script creates a guest account if no token is provided.
        const createGuestAccount = async () => {
            console.log('Creating guest account for API access...');
            const res = await fetch('https://api.gofile.io/accounts', {
                method: 'POST',
                headers: {
                    'User-Agent': 'ObsidianPanel/1.0',
                    'Accept': '*/*'
                }
            });
            const json = await res.json();
            if (json.status !== 'ok') throw new Error('Failed to create guest account');
            return json.data.token;
        };

        const token = await createGuestAccount();
        console.log('Guest token obtained.');

        // Extract Content ID
        const parts = backup.downloadPage.split('/');
        const contentId = parts[parts.length - 1];

        // Helper: Fetch Folder Data
        // Logic from gofile-downloader.py: _build_content_tree_structure
        // The script uses: contentId, password (if any), and X-Website-Token header.
        // It ALSO uses the session which has Authorization and Cookie set from the token.
        const fetchFolderData = async (id, authToken) => {
            const url = `https://api.gofile.io/contents/${id}?cache=true`;
            const headers = {
                'Authorization': `Bearer ${authToken}`,
                'Cookie': `accountToken=${authToken}`,
                'User-Agent': 'ObsidianPanel/1.0',
                'X-Website-Token': '4fd6sg89d7s6', // Crucial: From config.js and python script
                'Accept': '*/*'
            };
            const res = await fetch(url, { headers });
            const json = await res.json();
            if (json.status !== 'ok') {
                // If error-token, maybe token expired? But we just made it.
                throw new Error(`GoFile API Error: ${json.status}`);
            }
            return json.data;
        };

        console.log(`Fetching metadata for Content ID: ${contentId}`);
        const data = await fetchFolderData(contentId, token);

        // Find the file
        if (!data.children) throw new Error('No files found in this content ID');
        const children = Object.values(data.children);
        const targetFile = children.find(f => f.name === backup.fileName);

        if (!targetFile || !targetFile.link) {
            throw new Error(`File ${backup.fileName} not found in GoFile folder`);
        }

        const downloadUrl = targetFile.link;
        console.log(`Downloading from: ${downloadUrl}`);

        const tempDir = process.env.TEMP_BACKUP_PATH || path.resolve(__dirname, '../../tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Use an absolute path for safety
        downloadPath = path.resolve(tempDir, `restore-${backup.fileName}`);

        // Clean up previous attempts

        // Using multi_replace to fix scope.


        // Clean up previous attempts
        if (fs.existsSync(downloadPath)) fs.unlinkSync(downloadPath);

        // Download File
        // The script uses the same session, so it sends Auth/Cookie/User-Agent.
        // Public downloads might work without it, but we follow the script to be safe.
        const downloadRes = await fetch(downloadUrl, {
            headers: {
                'Cookie': `accountToken=${token}`,
                'Authorization': `Bearer ${token}`, // Include Bearer as well
                'User-Agent': 'ObsidianPanel/1.0'
            }
        });

        if (!downloadRes.ok) throw new Error(`Download failed: ${downloadRes.status}`);

        // Stream to file
        const fileStream = fs.createWriteStream(downloadPath);
        await new Promise((resolve, reject) => {
            // @ts-ignore
            if (downloadRes.body) {
                // Convert web stream to node stream if necessary or just write array buffer
                // fetch in Node 18+ returns a web standard ReadableStream. 
                // We can use arrayBuffer() for simplicity if file isn't massive, 
                // or stream it properly. For now, arrayBuffer is safer for small/medium files.
                // But let's try to stream it for efficiency.
                const { Readable } = require('stream');
                // @ts-ignore
                Readable.fromWeb(downloadRes.body).pipe(fileStream);
                fileStream.on('finish', resolve);
                fileStream.on('error', reject);
            } else {
                reject(new Error('No response body'));
            }
        });

        console.log('Download complete.');

        // 4. Unzip
        console.log('Extracting...');
        // Ensure paths are quoted to handle spaces
        let unzipCmd = `unzip -o -q "${downloadPath}" -d "${serverDir}"`;

        if (backup.encryptionPassword) {
            unzipCmd = `unzip -o -q -P "${backup.encryptionPassword}" "${downloadPath}" -d "${serverDir}"`;
        }

        await new Promise((resolve, reject) => {
            exec(unzipCmd, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Unzip failed: ${stderr || error.message}`));
                } else {
                    resolve();
                }
            });
        });

        // Restore EULA if missing
        if (!fs.existsSync(minecraftService.jarFile)) {
            console.warn('Warning: Server JAR missing after restore. You may need to reinstall version.');
        } else {
            try { fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true'); } catch (e) { }
        }

        console.log('Restore complete.');
        res.json({ success: true, message: 'Server restored successfully.' });

    } catch (err) {
        console.error('Restore Error:', err);
        res.status(500).json({ message: err.message || 'Restore failed' });
    } finally {
        // ALWAYS Clean up temp file and unlock operations
        if (downloadPath && fs.existsSync(downloadPath)) {
            try {
                fs.unlinkSync(downloadPath);
                console.log('Cleaned up temp restore file:', downloadPath);
            } catch (e) {
                console.warn("Cleanup warning:", e.message);
            }
        }
        isRestoreInProgress = false;
        minecraftService.isOperationLocked = false;
    }
});

// @route   DELETE api/backups/:id

router.get('/', auth, async (req, res) => {
    try {
        const backups = await Backup.find().sort({ createdAt: -1 });
        res.json(backups);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/backups/create
// @desc    Create a backup and upload to GoFile
// @access  Private
// @route   POST api/backups/create
// @desc    Create a backup and upload to GoFile
// @access  Private
router.post('/create', auth, async (req, res) => {
    try {
        const backup = await backupService.performBackup(true); // manualTrigger=true
        res.json(backup);
    } catch (err) {
        if (err.message === 'Backup already in progress') {
            return res.status(409).json({ message: err.message });
        }
        res.status(500).json({ message: err.message });
    }
});

// @route   GET api/backups/config
// @desc    Get auto-backup settings
// @access  Private
router.get('/config', auth, async (req, res) => {
    try {
        const settings = await backupService.getSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/backups/config
// @desc    Update auto-backup settings
// @access  Private
router.post('/config', auth, async (req, res) => {
    try {
        const newSettings = await backupService.saveSettings(req.body);
        res.json(newSettings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   DELETE api/backups/:id
// @desc    Delete a backup record
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const backup = await Backup.findById(req.params.id);
        if (!backup) return res.status(404).json({ message: 'Backup not found' });

        await Backup.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
