const https = require('https');
const fs = require('fs');
const path = require('path');
const minecraftService = require('./minecraftService');

class PluginService {
    constructor() {
        this.userAgent = 'ObsidianPanel/1.0';
    }

    async _get(url, followRedirects = false) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': this.userAgent }
            };
            https.get(url, options, (res) => {
                if (followRedirects && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return this._get(res.headers.location, true).then(resolve).catch(reject);
                }

                // If asking for JSON but got binary (or just need to confirm success for download stream usage later)
                // For this helper, we strictly expect JSON unless it's a redirect handled above.
                // However, for download streams, we don't use this helper directly.

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        return reject(new Error(`API request failed with status ${res.statusCode}: ${data.substring(0, 100)}`));
                    }
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        // Fallback for non-JSON responses if needed, though mostly we expect JSON
                        resolve(data);
                    }
                });
            }).on('error', reject);
        });
    }

    // --- Providers ---

    async _searchModrinth(query, limit) {
        try {
            const data = await this._get(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=${limit}`);
            return (data.hits || []).map(hit => ({
                id: hit.project_id,
                name: hit.title,
                description: hit.description,
                source: 'Modrinth',
                iconUrl: hit.icon_url,
                downloads: hit.downloads,
                author: hit.author
            }));
        } catch (e) {
            console.error("Modrinth Search Error:", e.message);
            return [];
        }
    }

    async _searchHangar(query, limit) {
        try {
            const data = await this._get(`https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(query)}&limit=${limit}`);
            return (data.result || []).map(p => ({
                id: p.namespace.slug, // Hangar uses slug as ID
                name: p.name,
                description: p.description,
                source: 'Hangar',
                iconUrl: p.avatarUrl,
                downloads: p.stats.downloads,
                author: p.namespace.owner
            }));
        } catch (e) {
            console.error("Hangar Search Error:", e.message);
            return [];
        }
    }

    async _searchSpiget(query, limit) {
        try {
            const data = await this._get(`https://api.spiget.org/v2/search/resources/${encodeURIComponent(query)}?size=${limit}&sort=-downloads`);
            return (data || []).map(r => ({
                id: r.id,
                name: r.name,
                description: r.tag,
                source: 'Spigot',
                iconUrl: r.icon ? `https://www.spigotmc.org/${r.icon.url}` : null,
                downloads: r.downloads,
                author: r.author ? r.author.id : 'Unknown' // Spiget author is an object or ID
            }));
        } catch (e) {
            console.error("Spiget Search Error:", e.message);
            return [];
        }
    }

    // --- Public API ---

    async search(query, limit = 10) {
        // Run all searches in parallel
        const [modrinth, hangar, spiget] = await Promise.all([
            this._searchModrinth(query, limit),
            this._searchHangar(query, limit),
            this._searchSpiget(query, limit)
        ]);

        // Interleave results or strict concat? 
        // Let's just concat for now: Modrinth > Hangar > Spigot
        return [...modrinth, ...hangar, ...spiget];
    }

    async install(source, id, version, loaders) {
        // Normalize loaders
        const loaderList = Array.isArray(loaders) ? loaders : [loaders];
        const pluginsDir = path.join(minecraftService.serverDir, 'plugins');
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
        }

        let downloadUrl;
        let filename;

        if (source === 'Modrinth') {
            const versions = await this._get(`https://api.modrinth.com/v2/project/${id}/version`);
            const compatible = versions.find(v => v.game_versions.includes(version) && v.loaders.some(l => loaderList.includes(l)));
            if (!compatible) throw new Error(`Modrinth: No version found for ${version}`);
            const file = compatible.files.find(f => f.primary) || compatible.files[0];
            downloadUrl = file.url;
            filename = file.filename;
        } else if (source === 'Hangar') {
            // Hangar ID is slug
            const versions = await this._get(`https://hangar.papermc.io/api/v1/projects/${id}/versions`);
            // Hangar versions structure is different, need to filter 'platformDependencies'
            // result is { pagination: {}, result: [] } or just [] depending on endpoint?
            // "GET /projects/{slug}/versions" returns { pagination, result: [ ... ] }

            const list = versions.result || [];
            const compatible = list.find(v => {
                // Check detailed platform deps
                // v.platformDependencies is object { PAPER: ["1.20"], WATERFALL: [...] }
                // We assume PAPER for now
                const deps = v.platformDependencies['PAPER'] || [];
                return deps.includes(version);
                // Note: Hangar often uses ranges or exact. If exact fails, might need smarter logic.
                // For this MVP, we try exact match.
            }) || list[0]; // Fallback to latest if exact fail (risky but better than nothing)

            if (!compatible) throw new Error(`Hangar: No version found for ${version}`);

            // Prefer direct download URL from API if available
            if (compatible.downloads && compatible.downloads['PAPER'] && compatible.downloads['PAPER'].downloadUrl) {
                downloadUrl = compatible.downloads['PAPER'].downloadUrl;
            } else {
                // Fallback to constructed URL
                downloadUrl = `https://hangar.papermc.io/api/v1/projects/${id}/versions/${compatible.name}/PAPER/download`;
            }

            filename = `${id}-${compatible.name}.jar`;

        } else if (source === 'Spigot') {
            // Spigot doesn't have robust version filtering via API easily
            // We just grab the latest resource update
            downloadUrl = `https://api.spiget.org/v2/resources/${id}/download`;
            // Retrieve info to guess filename
            const info = await this._get(`https://api.spiget.org/v2/resources/${id}`);
            filename = `${info.name}.jar`;
        } else {
            throw new Error(`Unknown source: ${source}`);
        }

        return new Promise((resolve, reject) => {
            const filePath = path.join(pluginsDir, filename);
            const fileStream = fs.createWriteStream(filePath);

            // Helper to handle redirects manually for the stream
            const download = (url) => {
                https.get(url, { headers: { 'User-Agent': this.userAgent } }, (res) => {
                    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                        return download(res.headers.location);
                    }
                    if (res.statusCode >= 400) {
                        return reject(new Error(`Download failed: ${res.statusCode}`));
                    }
                    res.pipe(fileStream);
                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve({ filename, source });
                    });
                }).on('error', (err) => {
                    fs.unlink(filePath, () => { });
                    reject(err);
                });
            };

            download(downloadUrl);
        });
    }
}

module.exports = new PluginService();
