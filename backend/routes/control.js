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

module.exports = router;
