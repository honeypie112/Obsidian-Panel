const express = require('express');
const router = express.Router();
const Backup = require('../models/Backup');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const BACKUP_DIR = path.join(__dirname, '../../backups');
const SERVER_DIR = process.env.MC_SERVER_BASE_PATH || './servers';

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// @route   GET api/backups
// @desc    Get all backups
router.get('/', auth, async (req, res) => {
    try {
        const backups = await Backup.find().sort({ createdAt: -1 });
        res.json(backups);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   POST api/backups/create
// @desc    Create a backup (Mock implementation using simple copy/zip or just dummy for now)
router.post('/create', auth, async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `backup-${timestamp}.zip`;
        const filePath = path.join(BACKUP_DIR, fileName);

        // For now, create a dummy file to simulate backup
        // In real impl, use 'archiver' or 'zip -r'
        fs.writeFileSync(filePath, 'Mock backup content');

        const newBackup = new Backup({
            fileName,
            size: '0MB', // Calculate real size
            path: filePath,
            downloadPage: `/api/backups/download/${fileName}` // Serve static or stream
        });

        await newBackup.save();
        res.json(newBackup);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Backup creation failed' });
    }
});

// @route   DELETE api/backups/:id
// @desc    Delete a backup
router.delete('/:id', auth, async (req, res) => {
    try {
        const backup = await Backup.findById(req.params.id);
        if (!backup) {
            return res.status(404).json({ message: 'Backup not found' });
        }

        // Delete file
        if (fs.existsSync(backup.path)) {
            fs.unlinkSync(backup.path);
        }

        // Delete DB record
        await Backup.findByIdAndDelete(req.params.id);

        res.json({ message: 'Backup deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
});

// @route   GET api/backups/status
// @desc    Get backup status
router.get('/status', auth, (req, res) => {
    res.json({ isBackupInProgress: false });
});

module.exports = router;
