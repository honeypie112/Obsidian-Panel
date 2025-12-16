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
        const loaderMap = {
            'paper': 'paper',
            'purpur': 'purpur',
            'spigot': 'spigot',
            'bukkit': 'bukkit',
            'vanilla': 'paper' // Fallback: if they start installing plugins, they probably want paper/spigot plugins
        };

        const loader = loaderMap[type] || 'paper';

        if (!projectId) {
            return res.status(400).json({ error: 'Project ID is required' });
        }

        console.log(`Installing plugin ${projectId} for ${version} (${loader})`);

        const result = await pluginService.install(projectId, version, loader);
        res.json({ success: true, ...result });

    } catch (err) {
        console.error('Install error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
