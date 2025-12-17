const express = require('express');
const router = express.Router();
const minecraftService = require('../services/minecraftService');
const { auth, checkPermission } = require('../middleware');

router.get('/status', auth, (req, res) => {
    res.json(minecraftService.getStatus());
});

router.post('/action', auth, checkPermission('overview.control'), (req, res) => {
    const { action } = req.body;
    try {
        switch (action) {
            case 'start':
                minecraftService.start();
                break;
            case 'stop':
                minecraftService.stop();
                break;
            case 'restart':
                minecraftService.stop();
                setTimeout(() => minecraftService.start(), 5000);
                break;
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
        res.json(minecraftService.getStatus());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/command', auth, checkPermission('console.command'), (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ message: 'Command required' });
    }
    minecraftService.sendCommand(command);
    res.json({ success: true });
});

router.post('/install', auth, checkPermission('settings.edit'), async (req, res) => {
    const { version } = req.body;
    console.log("Install request received. Body:", req.body);
    console.log("Installing version:", version);
    try {
        await minecraftService.install(version);
        res.json({ message: 'Installation started' });
    } catch (err) {
        console.error("Install failed:", err);
        res.status(500).json({ message: err.message });
    }
});

router.post('/config', auth, checkPermission('settings.edit'), (req, res) => {
    try {
        minecraftService.saveConfig(req.body);
        res.json(minecraftService.getStatus());
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Use a temp dir in the server directory to avoid /tmp partition size limits
        const tempDir = path.join(minecraftService.serverDir, '.temp_uploads');
        if (!fs.existsSync(tempDir)) {
            try {
                fs.mkdirSync(tempDir, { recursive: true });
            } catch (e) {
                console.error("Failed to create temp upload dir:", e);
                return cb(e);
            }
        }
        cb(null, tempDir);
    }
});
const upload = multer({
    storage: storage,
    limits: { fileSize: Infinity } // Explicitly remove file size limit
});
const getSafePath = (reqPath) => {
    const serverDir = minecraftService.serverDir;
    const targetPath = path.join(serverDir, reqPath || '');
    if (!targetPath.startsWith(serverDir)) {
        throw new Error('Access denied: Invalid path');
    }
    return targetPath;
};
router.post('/files/list', auth, checkPermission('files.view'), (req, res) => {
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
        files.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });
        res.json(files);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/files/read', auth, checkPermission('files.view'), (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);
        if (!fs.existsSync(targetPath)) return res.status(404).json({ message: 'File not found' });
        const content = fs.readFileSync(targetPath, 'utf8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/files/save', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath, content } = req.body;
        const targetPath = getSafePath(relPath);
        fs.writeFileSync(targetPath, content, 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.post('/files/download', auth, checkPermission('files.view'), (req, res) => {
    try {
        const { path: relPath } = req.body;
        const targetPath = getSafePath(relPath);
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ message: 'File not found' });
        }
        res.download(targetPath, path.basename(targetPath), (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.status(500).json({ message: 'Download failed' });
                }
            }
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
const uploadMiddleware = upload.single('file');

router.post('/files/upload', auth, checkPermission('files.upload'), (req, res) => {
    uploadMiddleware(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // A Multer error occurred when uploading.
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ message: 'File too large' });
            }
            return res.status(500).json({ message: `Upload error: ${err.message}` });
        } else if (err) {
            // An unknown error occurred when uploading.
            return res.status(500).json({ message: `Upload error: ${err.message}` });
        }

        // Everything went fine.
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const { path: relPath } = req.body;
            const targetDir = getSafePath(relPath);
            const tempPath = req.file.path;
            const targetPath = path.join(targetDir, req.file.originalname);

            // Check disk space (basic check) or write permission implicit in rename
            try {
                fs.renameSync(tempPath, targetPath);
            } catch (error) {
                if (error.code === 'EXDEV') {
                    fs.copyFileSync(tempPath, targetPath);
                    fs.unlinkSync(tempPath);
                } else if (error.code === 'ENOSPC') {
                    throw new Error('Disk full');
                } else {
                    throw error;
                }
            }
            res.json({ success: true });
        } catch (err) {
            console.error("Upload error:", err);
            // Clean up temp file if exists
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) { }
            }
            res.status(500).json({ message: err.message });
        }
    });
});
router.post('/files/create', auth, checkPermission('files.upload'), (req, res) => {
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
router.post('/files/extract', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath } = req.body;
        const targetPath = getSafePath(relPath);
        const parentDir = path.dirname(targetPath);
        const { exec } = require('child_process');
        let cmd;
        if (targetPath.endsWith('.zip')) {
            cmd = `unzip -o "${targetPath}" -d "${parentDir}"`;
        } else if (targetPath.endsWith('.tar.gz')) {
            cmd = `tar -xzf "${targetPath}" -C "${parentDir}"`;
        } else {
            return res.status(400).json({ message: 'Unsupported archive format' });
        }
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec error: ${error}`);
                return res.status(500).json({ message: 'Extraction failed. Ensure unzip/tar is installed.' });
            }
            res.json({ success: true });
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/files/compress', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { files, currentPath } = req.body; // files is array of filenames, currentPath is relative path
        if (!files || !Array.isArray(files) || files.length === 0) {
            return res.status(400).json({ message: 'No files selected' });
        }

        const safeCurrentDir = getSafePath(currentPath);
        const archiveName = `archive_${Date.now()}.zip`;
        const targetArchive = path.join(safeCurrentDir, archiveName);

        // Escape filenames for shell command
        const fileArgs = files.map(f => `"${f}"`).join(' ');

        const { exec } = require('child_process');
        // cd to directory first so zip doesn't include full absolute paths
        const cmd = `cd "${safeCurrentDir}" && zip -r "${archiveName}" ${fileArgs}`;

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Zip error: ${error}`);
                return res.status(500).json({ message: 'Compression failed. Ensure zip is installed.' });
            }
            res.json({ success: true, archiveName });
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
// Rename File/Folder
router.post('/files/rename', auth, checkPermission('files.edit'), (req, res) => {
    try {
        const { path: relPath, oldName, newName } = req.body;
        // relPath is the folder path (e.g. "plugins") where the file exists
        const currentDir = getSafePath(relPath);

        const oldPath = path.join(currentDir, oldName);
        const newPath = path.join(currentDir, newName);

        // Security check: Ensure new path is still within safe directory
        // Although getSafePath checked currentDir, newName could try ".." traversal
        if (!newPath.startsWith(minecraftService.serverDir)) {
            return res.status(400).json({ message: 'Invalid new name' });
        }

        if (!fs.existsSync(oldPath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (fs.existsSync(newPath)) {
            return res.status(400).json({ message: 'A file with that name already exists' });
        }

        fs.renameSync(oldPath, newPath);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/files/delete', auth, checkPermission('files.delete'), (req, res) => {
    try {
        const { path: relPath } = req.body;
        const targetPath = getSafePath(relPath);
        const stats = fs.statSync(targetPath);
        if (stats.isDirectory()) {
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
