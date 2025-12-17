const express = require('express');
const router = express.Router();
const pluginService = require('../services/pluginService');
const minecraftService = require('../services/minecraftService');

const { auth, checkPermission } = require('../middleware');

// Search Plugins
router.get('/search', auth, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }
        const results = await pluginService.search(query);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Failed to search plugins' });
    }
});

// Install Plugin
router.post('/install', auth, checkPermission('plugins.manage'), async (req, res) => {
    try {
        const { projectId, source = 'Modrinth' } = req.body;

        // Get current server config automatically
        const config = minecraftService.config;
        const version = config.version; // e.g., '1.20.4'
        let type = config.type || 'vanilla';

        // Map server type to compatible Modrinth loaders
        const loaderMap = {
            'paper': ['paper', 'purpur', 'spigot', 'bukkit'],
            'purpur': ['purpur', 'paper', 'spigot', 'bukkit'],
            'spigot': ['spigot', 'bukkit', 'paper'],
            'bukkit': ['bukkit', 'spigot'],
            'vanilla': ['paper', 'purpur', 'spigot', 'bukkit'] // Fallback
        };

        const loaders = loaderMap[type] || ['paper', 'purpur', 'spigot', 'bukkit'];

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        console.log(`Installing plugin ${projectId} from ${source} for ${version} (loaders: ${loaders.join(', ')})`);

        const result = await pluginService.install(source, projectId, version, loaders);
        res.json({ success: true, ...result });

    } catch (err) {
        console.error('Install error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
