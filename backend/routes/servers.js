const express = require('express');
const axios = require('axios');
const Server = require('../models/Server');
const authMiddleware = require('../middleware/auth');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();

// Get all servers
router.get('/', authMiddleware, async (req, res) => {
    try {
        const servers = await Server.find().sort({ createdAt: -1 });
        res.json(servers);
    } catch (error) {
        console.error('Get servers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get server by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }
        res.json(server);
    } catch (error) {
        console.error('Get server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Create new server
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, port, version, memory } = req.body;

        // Check if port is already in use
        const existingServer = await Server.findOne({ port });
        if (existingServer) {
            return res.status(400).json({ error: 'Port already in use' });
        }

        // Validate port range
        const minPort = parseInt(process.env.MC_PORT_RANGE_START) || 25565;
        const maxPort = parseInt(process.env.MC_PORT_RANGE_END) || 25575;

        if (port < minPort || port > maxPort) {
            return res.status(400).json({
                error: `Port must be between ${minPort} and ${maxPort}`
            });
        }

        // Create server directory
        const serverDir = path.join(
            process.env.MC_SERVER_BASE_PATH || './servers',
            `server_${port}`
        );

        await fs.mkdir(serverDir, { recursive: true });

        const server = new Server({
            name,
            port,
            version: version || '1.20.4',
            memory: memory || parseInt(process.env.MC_DEFAULT_MEMORY) || 2048,
            directory: serverDir,
        });

        await server.save();

        // Auto-download PurpurMC server JAR
        try {
            const jarPath = path.join(serverDir, 'server.jar');
            const downloadUrl = `https://api.purpurmc.org/v2/purpur/${server.version}/latest/download`;

            console.log(`Downloading PurpurMC ${server.version} for server ${server.name}...`);
            const response = await axios.get(downloadUrl, { responseType: 'stream' });
            const writer = require('fs').createWriteStream(jarPath);

            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            console.log(`✅ Downloaded server.jar for ${server.name}`);
        } catch (downloadError) {
            console.error('Failed to download server JAR:', downloadError.message);
            // Don't fail server creation if download fails
        }

        res.status(201).json(server);
    } catch (error) {
        console.error('Create server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start server
router.put('/:id/start', authMiddleware, async (req, res) => {
    try {
        const serverManager = req.app.get('serverManager');
        const result = await serverManager.startServer(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Start server error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Stop server
router.put('/:id/stop', authMiddleware, async (req, res) => {
    try {
        const serverManager = req.app.get('serverManager');
        const result = await serverManager.stopServer(req.params.id);
        res.json(result);
    } catch (error) {
        console.error('Stop server error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send console command
router.post('/:id/command', authMiddleware, async (req, res) => {
    try {
        const { command } = req.body;
        const serverManager = req.app.get('serverManager');
        const result = await serverManager.sendCommand(req.params.id, command);
        res.json(result);
    } catch (error) {
        console.error('Send command error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Download server JAR
router.post('/:id/download-jar', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Check if server is running
        if (server.status !== 'offline') {
            return res.status(400).json({ error: 'Cannot download JAR while server is running' });
        }

        const jarPath = path.join(server.directory, 'server.jar');
        const downloadUrl = `https://api.purpurmc.org/v2/purpur/${server.version}/latest/download`;

        console.log(`Downloading PurpurMC ${server.version} for server ${server.name}...`);

        const response = await axios.get(downloadUrl, { responseType: 'stream' });
        const writer = require('fs').createWriteStream(jarPath);

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        console.log(`✅ Downloaded server.jar for ${server.name}`);
        res.json({ message: 'Server JAR downloaded successfully' });
    } catch (error) {
        console.error('Download JAR error:', error);
        res.status(500).json({ error: 'Failed to download server JAR: ' + error.message });
    }
});

// Delete server
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.id);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Check if server is running
        if (server.status !== 'offline') {
            return res.status(400).json({ error: 'Cannot delete running server' });
        }

        // Delete server directory (optional, be careful!)
        // await fs.rm(server.directory, { recursive: true, force: true });

        await Server.findByIdAndDelete(req.params.id);
        res.json({ message: 'Server deleted successfully' });
    } catch (error) {
        console.error('Delete server error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete server
router.delete('/:serverId', authMiddleware, async (req, res) => {
    try {
        const server = await Server.findById(req.params.serverId);
        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Stop server if running
        const serverManager = req.app.get('serverManager');
        try {
            await serverManager.stopServer(req.params.serverId);
        } catch (err) {
            // Server might not be running, ignore
        }

        // Delete server directory
        const fs = require('fs').promises;
        try {
            await fs.rm(server.directory, { recursive: true, force: true });
        } catch (err) {
            console.error('Failed to delete server directory:', err);
        }

        // Delete from database
        await Server.findByIdAndDelete(req.params.serverId);

        res.json({ message: 'Server deleted successfully' });
    } catch (error) {
        console.error('Delete server error:', error);
        res.status(500).json({ error: 'Failed to delete server' });
    }
});

// Update server settings (version, memory, etc.)
router.put('/:serverId/settings', authMiddleware, async (req, res) => {
    try {
        const { version, memory, name } = req.body;
        const server = await Server.findById(req.params.serverId);

        if (!server) {
            return res.status(404).json({ error: 'Server not found' });
        }

        // Update fields if provided
        if (version) server.version = version;
        if (memory) server.memory = memory;
        if (name) server.name = name;

        await server.save();

        res.json({
            message: 'Server settings updated successfully',
            server
        });
    } catch (error) {
        console.error('Update server settings error:', error);
        res.status(500).json({ error: 'Failed to update server settings' });
    }
});

module.exports = router;
