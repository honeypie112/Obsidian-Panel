const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

// Base path for Minecraft server files (configurable)
const SERVER_PATH = process.env.MC_SERVER_BASE_PATH || './servers';

// Ensure server directory exists
if (!fs.existsSync(SERVER_PATH)) {
    fs.mkdirSync(SERVER_PATH, { recursive: true });
}

// @route   GET api/server/files
// @desc    List files in a directory
router.get('/files', auth, (req, res) => {
    const subPath = req.query.path || '';
    // Prevent directory traversal attacks
    if (subPath.includes('..')) {
        return res.status(400).json({ message: 'Invalid path' });
    }

    const fullPath = path.join(SERVER_PATH, subPath);

    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ message: 'Path not found' });
    }

    try {
        const items = fs.readdirSync(fullPath, { withFileTypes: true });
        const files = items.map(item => ({
            name: item.name,
            type: item.isDirectory() ? 'folder' : 'file',
            size: item.isDirectory() ? '-' : formatBytes(fs.statSync(path.join(fullPath, item.name)).size)
        }));

        // Sort: Folders first, then files
        files.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        });

        res.json(files);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST api/server/files/create
// @desc    Create a file or folder
router.post('/files/create', auth, (req, res) => {
    const { path: subPath, name, type } = req.body;
    if (subPath.includes('..') || name.includes('..') || name.includes('/')) {
        return res.status(400).json({ message: 'Invalid name or path' });
    }

    const fullPath = path.join(SERVER_PATH, subPath, name);

    try {
        if (fs.existsSync(fullPath)) {
            return res.status(400).json({ message: 'File/Folder already exists' });
        }

        if (type === 'folder') {
            fs.mkdirSync(fullPath);
        } else {
            fs.writeFileSync(fullPath, ''); // Create empty file
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE api/server/files
// @desc    Delete a file or folder
router.delete('/files', auth, (req, res) => {
    const { path: subPath, name } = req.body;
    if (subPath.includes('..') || name.includes('..')) {
        return res.status(400).json({ message: 'Invalid path' });
    }

    const fullPath = path.join(SERVER_PATH, subPath, name);

    try {
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            fs.rmdirSync(fullPath, { recursive: true });
        } else {
            fs.unlinkSync(fullPath);
        }

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

module.exports = router;
