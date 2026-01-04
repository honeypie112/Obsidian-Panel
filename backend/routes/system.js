const express = require('express');
const router = express.Router();
const axios = require('axios');
const { auth } = require('../middleware');

// GET /api/system/update-check
router.get('/update-check', auth, async (req, res) => {
    try {
        // fetch latest tag info from Docker Hub
        const response = await axios.get('https://hub.docker.com/v2/repositories/alexbhai/obsidian-panel/tags/latest');

        const latestData = response.data;
        const lastUpdated = latestData.last_updated; // ISO String: "2024-05-20T10:00:00.000Z"

        // Get local build date from env var (injected by Docker)
        const currentBuildDate = process.env.BUILD_DATE;

        let updateAvailable = false;

        if (currentBuildDate && lastUpdated) {
            const current = new Date(currentBuildDate).getTime();
            const latest = new Date(lastUpdated).getTime();

            console.log(`[UpdateCheck] Local: ${currentBuildDate} (${current}) | Remote: ${lastUpdated} (${latest})`);

            // If latest is significantly newer (e.g. > 1 hour difference to avoid potential timezone/build time mismatches on same build)
            if (latest > current + 1000 * 60 * 60) {
                updateAvailable = true;
            }
        } else if (!currentBuildDate) {
            console.log('[UpdateCheck] BUILD_DATE env var is missing. Cannot verify version.');
        }

        res.json({
            updateAvailable,
            currentBuildDate: currentBuildDate || 'Unknown',
            latestBuildDate: lastUpdated,
            latestTag: latestData.name
        });

    } catch (err) {
        console.error('Update check failed:', err.message);
        res.status(500).json({ message: 'Failed to check for updates' });
    }
});

module.exports = router;
