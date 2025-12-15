const express = require('express');
const router = express.Router();
const minecraftService = require('../services/minecraftService');
const auth = require('../middleware/auth');

// @route   GET api/control/status
// @desc    Get server status
// @access  Private
router.get('/status', auth, (req, res) => {
    res.json(minecraftService.getStatus());
});

// @route   POST api/control/action
// @desc    Start/Stop/Restart server
// @access  Private
router.post('/action', auth, (req, res) => {
    const { action } = req.body;

    try {
        switch (action) {
            case 'start':
                // The following logic for parsing RAM and constructing args
                // is typically handled within the minecraftService.start() method itself.
                // For this router, we simply call the service method.
                // If the intent was to pass RAM config from the request body,
                // minecraftService.start() would need to accept parameters.
                // As per the instruction "Update start() to parse RAM from config",
                // this logic should reside in the minecraftService.js file.
                // The provided snippet seems to be an example of what start() would do.
                minecraftService.start();
                break;
            case 'stop':
                minecraftService.stop();
                break;
            case 'restart':
                minecraftService.stop();
                setTimeout(() => minecraftService.start(), 5000); // Simple restart logic
                break;
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
        res.json(minecraftService.getStatus());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/command
// @desc    Send command to server console
// @access  Private
router.post('/command', auth, (req, res) => {
    const { command } = req.body;

    if (!command) {
        return res.status(400).json({ message: 'Command required' });
    }

    minecraftService.sendCommand(command);
    res.json({ success: true });
});

// @route   POST api/control/install
// @desc    Install/Update server JAR
// @access  Private
router.post('/install', auth, async (req, res) => {
    const { version } = req.body;
    console.log("Install request received. Body:", req.body);
    console.log("Installing version:", version);

    try {
        await minecraftService.install(version); // Async operation should be awaited to catch errors
        res.json({ message: 'Installation started' });
    } catch (err) {
        console.error("Install failed:", err);
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/config
// @desc    Update server configuration (name, ram, etc)
// @access  Private
router.post('/config', auth, (req, res) => {
    try {
        minecraftService.saveConfig(req.body);
        res.json(minecraftService.getStatus());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// --- File Management ---
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Configure upload storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // We defer destination resolution to the handler or use a temp dir if needed
        // But here we want to upload directly to the target path.
        // However, middleware runs before the body is fully parsed in some cases?
        // Let's use a temp dir or just the root server dir and move it later?
        // Actually, let's use the 'path' query param if possible, or just upload to server root.
        // For simplicity: Upload to root, frontend can handle logic or we move it.
        // BETTER: Use /tmp and move in the handler to sanitize paths.
        cb(null, '/tmp');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Helper: Sanitize and resolve path
const getSafePath = (reqPath) => {
    const serverDir = minecraftService.serverDir;
    // reqPath is relative, e.g., "logs/latest.log" or ""
    const targetPath = path.join(serverDir, reqPath || '');

    // Prevent directory traversal
    if (!targetPath.startsWith(serverDir)) {
        throw new Error('Access denied: Invalid path');
    }
    return targetPath;
};

// @route   POST api/control/files/list
// @desc    List files in a directory
router.post('/files/list', auth, (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);

        if (!fs.existsSync(targetPath)) {
            return res.json([]);
        }

        const entries = fs.readdirSync(targetPath, { withFileTypes: true });

        const files = entries.map(entry => {
            let size = '-';
            if (entry.isFile()) {
                const stats = fs.statSync(path.join(targetPath, entry.name));
                // Convert to KB/MB
                if (stats.size < 1024) size = stats.size + ' B';
                else if (stats.size < 1024 * 1024) size = (stats.size / 1024).toFixed(1) + ' KB';
                else size = (stats.size / (1024 * 1024)).toFixed(1) + ' MB';
            } else if (entry.isDirectory()) {
                try {
                    const subFiles = fs.readdirSync(path.join(targetPath, entry.name));
                    size = `${subFiles.length} item${subFiles.length !== 1 ? 's' : ''}`;
                } catch (e) {
                    size = 'Unknown';
                }
            }

            return {
                name: entry.name,
                type: entry.isDirectory() ? 'folder' : 'file',
                size: size
            };
        });

        // Sort: Folders first
        files.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        res.json(files);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/files/read
// @desc    Read text file content
router.post('/files/read', auth, (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);
        if (!fs.existsSync(targetPath)) return res.status(404).json({ message: 'File not found' });

        // Check if binary? simple check
        // For now assume text as per requirement
        const content = fs.readFileSync(targetPath, 'utf8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/files/save
// @desc    Save content to file
router.post('/files/save', auth, (req, res) => {
    try {
        const { path: relPath, content } = req.body;
        const targetPath = getSafePath(relPath);

        fs.writeFileSync(targetPath, content, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/files/upload
// @desc    Upload file
router.post('/files/upload', auth, upload.single('file'), (req, res) => {
    try {
        const { path: relPath } = req.body; // Target folder relative path
        const targetDir = getSafePath(relPath);

        const tempPath = req.file.path;
        const targetPath = path.join(targetDir, req.file.originalname);

        // Move from temp to target (Handle EXDEV for cross-device moves)
        try {
            fs.renameSync(tempPath, targetPath);
        } catch (error) {
            if (error.code === 'EXDEV') {
                fs.copyFileSync(tempPath, targetPath);
                fs.unlinkSync(tempPath);
            } else {
                throw error;
            }
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/files/create
// @desc    Create file or directory
router.post('/files/create', auth, (req, res) => {
    try {
        const { path: relPath, name, type } = req.body;
        const currentDir = getSafePath(relPath);
        const targetPath = path.join(currentDir, name);

        if (type === 'folder') {
            fs.mkdirSync(targetPath);
        } else {
            fs.writeFileSync(targetPath, '', 'utf8');
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/files/extract
// @desc    Extract .zip or .tar.gz files
router.post('/files/extract', auth, (req, res) => {
    try {
        const { path: relPath } = req.body;
        const targetPath = getSafePath(relPath);
        const parentDir = path.dirname(targetPath);
        const { exec } = require('child_process');

        let cmd;
        if (targetPath.endsWith('.zip')) {
            // unzip -o (overwrite) -d (destination)
            cmd = `unzip -o "${targetPath}" -d "${parentDir}"`;
        } else if (targetPath.endsWith('.tar.gz')) {
            // tar -xzf (extract, gzip, file) -C (destination)
            cmd = `tar -xzf "${targetPath}" -C "${parentDir}"`;
        } else {
            return res.status(400).json({ message: 'Unsupported archive format' });
        }

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec error: ${error}`);
                // Often system might not have unzip installed, handle that?
                return res.status(500).json({ message: 'Extraction failed. Ensure unzip/tar is installed.' });
            }
            res.json({ success: true });
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// @route   POST api/control/files/delete
// @desc    Delete file or directory
router.post('/files/delete', auth, (req, res) => {
    try {
        const { path: relPath } = req.body;
        const targetPath = getSafePath(relPath);

        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
            // Using rmSync with recursive: true to force delete non-empty folders
            fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(targetPath);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
