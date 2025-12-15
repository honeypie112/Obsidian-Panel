const express = require('express');
const router = express.Router();
const minecraftService = require('../services/minecraftService');
const auth = require('../middleware/auth');
router.get('/status', auth, (req, res) => {
    res.json(minecraftService.getStatus());
});
router.post('/action', auth, (req, res) => {
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
router.post('/command', auth, (req, res) => {
    const { command } = req.body;
    if (!command) {
        return res.status(400).json({ message: 'Command required' });
    }
    minecraftService.sendCommand(command);
    res.json({ success: true });
});
router.post('/install', auth, async (req, res) => {
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
router.post('/config', auth, (req, res) => {
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
        cb(null, '/tmp');
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });
const getSafePath = (reqPath) => {
    const serverDir = minecraftService.serverDir;
    const targetPath = path.join(serverDir, reqPath || '');
    if (!targetPath.startsWith(serverDir)) {
        throw new Error('Access denied: Invalid path');
    }
    return targetPath;
};
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
router.post('/files/read', auth, (req, res) => {
    try {
        const targetPath = getSafePath(req.body.path);
        if (!fs.existsSync(targetPath)) return res.status(404).json({ message: 'File not found' });
        const content = fs.readFileSync(targetPath, 'utf8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
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
router.post('/files/download', auth, (req, res) => {
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
router.post('/files/upload', auth, upload.single('file'), (req, res) => {
    try {
        const { path: relPath } = req.body;  
        const targetDir = getSafePath(relPath);
        const tempPath = req.file.path;
        const targetPath = path.join(targetDir, req.file.originalname);
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
router.post('/files/extract', auth, (req, res) => {
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
router.post('/files/delete', auth, (req, res) => {
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
