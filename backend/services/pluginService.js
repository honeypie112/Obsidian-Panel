const https = require('https');
const fs = require('fs');
const path = require('path');
const minecraftService = require('./minecraftService');

class PluginService {
    constructor() {
        this.userAgent = 'ObsidianPanel/1.0';
    }

    _get(url) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': this.userAgent }
            };
            https.get(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode >= 400) {
                        return reject(new Error(`API request failed with status ${res.statusCode}: ${data}`));
                    }
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
    }

    async search(query, limit = 20) {
        // Facets: limit to plugins (project_type:mod is usually mods, but Modrinth mixes them. 
        // Best to just search and let user filter, or filter by 'project_type:plugin' if widely supported.
        // Actually, many "mods" are also plugins on Modrinth. 
        // For now, simple textual search.
        const encodedQuery = encodeURIComponent(query);
        const data = await this._get(`https://api.modrinth.com/v2/search?query=${encodedQuery}&limit=${limit}`);
        return data.hits || [];
    }

    async install(projectId, version, loaders) {
        // Ensure loaders is an array
        const loaderList = Array.isArray(loaders) ? loaders : [loaders];

        // 1. Get Project Versions
        const versions = await this._get(`https://api.modrinth.com/v2/project/${projectId}/version`);

        // 2. Filter for Compatible Version
        const compatible = versions.find(v =>
            v.game_versions.includes(version) &&
            v.loaders.some(l => loaderList.includes(l))
        );

        if (!compatible) {
            throw new Error(`No version found for Minecraft ${version} (loaders: ${loaderList.join(', ')})`);
        }

        // 3. Select Primary File
        const file = compatible.files.find(f => f.primary) || compatible.files[0];
        if (!file) throw new Error('No file found in version');

        // 4. Download
        const pluginsDir = path.join(minecraftService.serverDir, 'plugins');
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
        }

        const filePath = path.join(pluginsDir, file.filename);

        return new Promise((resolve, reject) => {
            const fileStream = fs.createWriteStream(filePath);
            https.get(file.url, (res) => {
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve({
                        filename: file.filename,
                        size: file.size,
                        version: compatible.version_number
                    });
                });
            }).on('error', (err) => {
                fs.unlink(filePath, () => { });
                reject(err);
            });
        });
    }
}

module.exports = new PluginService();
