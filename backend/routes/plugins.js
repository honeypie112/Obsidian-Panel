const express = require('express');
const router = express.Router();
const pluginService = require('../services/pluginService');
const minecraftService = require('../services/minecraftService');

// Search Plugins
router.get('/search', async (req, res) => {
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
router.post('/install', async (req, res) => {
    try {
        const { projectId } = req.body;

        // Get current server config automatically
        const config = minecraftService.config;
        const version = config.version; // e.g., '1.20.4'
        let type = config.type || 'vanilla';

        // Map server type to Modrinth loader
        // 'vanilla' doesn't support plugins, but user might be switching. 
        // Default to 'paper' as fallback loader search if vanilla, or just use type.
        // Actually, vanilla servers can't run plugins. 
        // But for "Plugin Store" usually implies Bukkit/Spigot/Paper context.
        // We'll map common types.
        // Map server type to compatible Modrinth loaders
        // User requested cross-compatibility between Paper and Purpur.
        // Both support Spigot/Bukkit plugins.
        const loaderMap = {
            'paper': ['paper', 'purpur', 'spigot', 'bukkit'],
            'purpur': ['purpur', 'paper', 'spigot', 'bukkit'],
            'spigot': ['spigot', 'bukkit', 'paper'], // 'paper' added generously as many paper plugins work on spigot if not using specific API
            'bukkit': ['bukkit', 'spigot'],
            'vanilla': ['paper', 'purpur', 'spigot', 'bukkit'] // Fallback
        };

        const loaders = loaderMap[type] || ['paper', 'purpur', 'spigot', 'bukkit'];

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        console.log(`Installing plugin ${projectId} for ${version} (loaders: ${loaders.join(', ')})`);

        const result = await pluginService.install(projectId, version, loaders);
        res.json({ success: true, ...result });

    } catch (err) {
        console.error('Install error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
