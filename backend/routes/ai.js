const express = require('express');
const authMiddleware = require('../middleware/auth');
const AICommandService = require('../services/AICommandService');
const Server = require('../models/Server');
const router = express.Router();

// Generate AI command suggestion
router.post('/generate-command', authMiddleware, async (req, res) => {
    try {
        const { prompt, serverId } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // Get server context if provided
        let serverContext = {};
        if (serverId) {
            const server = await Server.findById(serverId);
            if (server) {
                serverContext = {
                    version: server.version,
                    activePlayers: server.activePlayers,
                };
            }
        }

        const result = await AICommandService.generateCommand(prompt, serverContext);
        res.json(result);
    } catch (error) {
        console.error('AI Generate Command Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
