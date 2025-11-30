const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Server = require('../models/Server');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return cb(new Error('Server not found'));
        }

        const uploadPath = req.body.path
            ? path.join(server.directory, req.body.path)
            : server.directory;

        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

const upload = multer({
    storage,
    limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max file size
    },
});

// List files in server directory
router.get('/:serverId', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const targetPath = req.query.path
            ? path.join(server.directory, req.query.path)
            : server.directory;

        // Security check - prevent directory traversal
        if (!targetPath.startsWith(server.directory)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const items = await fs.readdir(targetPath, { withFileTypes: true });

        const files = await Promise.all(
            items.map(async (item) => {
                const fullPath = path.join(targetPath, item.name);
                const stats = await fs.stat(fullPath);

                return {
                    name: item.name,
                    isDirectory: item.isDirectory(),
                    size: stats.size,
                    modified: stats.mtime,
                    path: path.relative(server.directory, fullPath),
                };
            })
        );

        res.json({ files, currentPath: path.relative(server.directory, targetPath) || '/' });
    } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Upload file
router.post('/:serverId/upload', authMiddleware, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        res.json({
            message: 'File uploaded successfully',
            file: {
                name: req.file.filename,
                size: req.file.size,
                path: req.file.path,
            },
        });
    } catch (error) {
        console.error('Upload file error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Download file
router.get('/:serverId/download', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const filePath = path.join(server.directory, req.query.path);

        // Security check
        if (!filePath.startsWith(server.directory)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await fs.access(filePath);
        res.download(filePath);
    } catch (error) {
        console.error('Download file error:', error);
        res.status(404).json({ error: 'File not found' });
    }
});

// Read file content (for editing)
router.get('/:serverId/read', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const filePath = path.join(server.directory, req.query.path);

        // Security check
        if (!filePath.startsWith(server.directory)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content });
    } catch (error) {
        console.error('Read file error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Edit file
router.put('/:serverId/edit', authMiddleware, async (req, res) => {
    try {
        const { path: filePath, content } = req.body;
        const server = await Server.findById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const fullPath = path.join(server.directory, filePath);

        // Security check
        if (!fullPath.startsWith(server.directory)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await fs.writeFile(fullPath, content, 'utf-8');
        res.json({ message: 'File saved successfully' });
    } catch (error) {
        console.error('Edit file error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete file
router.delete('/:serverId/delete', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const filePath = path.join(server.directory, req.query.path);

        // Security check
        if (!filePath.startsWith(server.directory)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
            await fs.rm(filePath, { recursive: true });
        } else {
            await fs.unlink(filePath);
        }

        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Delete file error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Extract ZIP file
router.post('/:serverId/extract', authMiddleware, async (req, res) => {
    try {
        const { path: zipPath } = req.body;
        const server = await Server.findById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        const fullZipPath = path.join(server.directory, zipPath);

        // Security check
        const normalizedPath = path.normalize(fullZipPath);
        if (!normalizedPath.startsWith(server.directory)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Check if file exists and is a ZIP
        if (!fs.existsSync(fullZipPath)) {
            return res.status(404).json({ error: 'ZIP file not found' });
        }

        if (!fullZipPath.toLowerCase().endsWith('.zip')) {
            return res.status(400).json({ error: 'File is not a ZIP archive' });
        }

        // Extract ZIP
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(fullZipPath);
        const extractPath = path.dirname(fullZipPath);

        zip.extractAllTo(extractPath, true);

        res.json({
            message: 'ZIP file extracted successfully',
            extractedTo: path.relative(server.directory, extractPath)
        });
    } catch (error) {
        console.error('Extract ZIP error:', error);
        res.status(500).json({ error: 'Failed to extract ZIP file' });
    }
});

module.exports = router;
