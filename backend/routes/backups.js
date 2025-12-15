const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Backup = require('../models/Backup');
// const minecraftService = require('../services/minecraftService'); // For real backup creation

// @route   GET api/backups
// @desc    Get all backups
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const backups = await Backup.find().sort({ createdAt: -1 });
        res.json(backups);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/backups
// @desc    Create a new backup
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        // Mock Implementation for now until minecraftService is ready
        const newBackup = new Backup({
            fileName: `backup-${Date.now()}.zip`,
            size: '150MB',
            downloadPage: 'https://gofile.io/d/mock',
            fileId: 'mock-id',
            createdBy: req.user.id
        });

        const backup = await newBackup.save();
        res.json(backup);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/backups/:id
// @desc    Delete a backup
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const backup = await Backup.findById(req.params.id);

        if (!backup) {
            return res.status(404).json({ message: 'Backup not found' });
        }

        await backup.deleteOne(); // Delete from MongoDB

        res.json({ message: 'Backup removed' });
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Backup not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   GET api/backups/status
// @desc    Get backup status
// @access  Private
router.get('/status', auth, (req, res) => {
    res.json({ isBackupInProgress: false }); // Mock
});

// @route   GET api/backups/config
// @desc    Get backup config
// @access  Private
router.get('/config', auth, (req, res) => {
    res.json({ enabled: false, frequency: 'daily', cronExpression: '0 0 * * *' }); // Mock
});

module.exports = router;
