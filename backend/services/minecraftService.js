const ServerConfig = require('../models/ServerConfig');
const EventEmitter = require('events'); // Assuming EventEmitter is needed for the class
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');

// Cache for versions to avoid hitting Mojang API too often
let versionCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

class MinecraftService extends EventEmitter {
    constructor() {
        super();
        this.serverDir = path.join(__dirname, '../minecraft_server');
        this.jarFile = path.join(this.serverDir, 'server.jar');
        this.process = null;
        this.status = 'offline';

        // Default config
        this.config = {
            name: 'main-server',
            ram: '4GB',
            port: 25565,
            version: '1.20.4',
            type: 'vanilla'
        };

        // Ensure server directory exists
        if (!fs.existsSync(this.serverDir)) {
            fs.mkdirSync(this.serverDir, { recursive: true });
        }

        // Initialize DB config asynchronously
        // this.initDatabase(); // Removed: Called explicitly after DB connect
    }

    async initDatabase() {
        try {
            // Find existing or create default
            let configDoc = await ServerConfig.findOne({ name: 'main-server' });
            if (!configDoc) {
                configDoc = await ServerConfig.create(this.config);
                console.log("Created default ServerConfig in MongoDB");
            }
            // Update local memory cache
            this.config = {
                name: configDoc.name,
                ram: configDoc.ram,
                version: configDoc.version,
                name: configDoc.name,
                ram: configDoc.ram,
                version: configDoc.version,
                type: configDoc.type || 'vanilla',
                port: configDoc.port
            };
            console.log("Loaded ServerConfig from MongoDB:", this.config);
        } catch (err) {
            console.error("Failed to load config from DB:", err);
        }
    }

    async saveConfig(newConfig) {
        try {
            // Update memory
            this.config = { ...this.config, ...newConfig };
            console.log("Saving config to DB. New state:", this.config);

            // Update DB
            // allow upsert or update first found
            await ServerConfig.updateOne({ name: 'main-server' }, this.config, { upsert: true });
            console.log("Saved config to MongoDB");

            this.broadcast('status', this.getStatus());
        } catch (err) {
            console.error("Failed to save config to DB:", err);
            throw err;
        }
    }

    startStatsMonitoring() {
        if (this.statsInterval) clearInterval(this.statsInterval);

        let previousCpus = os.cpus();

        this.statsInterval = setInterval(async () => {
            // RAM Usage
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;

            // Disk Usage
            let storage = { total: 0, used: 0, free: 0 };
            try {
                if (fs.statfs) {
                    const stats = await fs.promises.statfs(this.serverDir);
                    storage.total = stats.bsize * stats.blocks;
                    storage.free = stats.bsize * stats.bfree;
                    storage.used = storage.total - storage.free;
                }
            } catch (e) { }

            // CPU Usage
            const currentCpus = os.cpus();
            let idle = 0;
            let total = 0;

            for (let i = 0; i < currentCpus.length; i++) {
                const prev = previousCpus[i];
                const curr = currentCpus[i];

                let prevTotal = 0;
                let currTotal = 0;

                for (const type in prev.times) prevTotal += prev.times[type];
                for (const type in curr.times) currTotal += curr.times[type];

                idle += curr.times.idle - prev.times.idle;
                total += currTotal - prevTotal;
            }

            const cpuUsage = total > 0 ? (1 - idle / total) * 100 : 0;
            previousCpus = currentCpus;

            const stats = {
                cpu: parseFloat(cpuUsage.toFixed(1)),
                cores: currentCpus.length,
                ram: {
                    total: totalMem,
                    used: usedMem,
                    free: freeMem
                },
                storage: storage
            };

            this.broadcast('stats', stats);
        }, 2000);
    }

    setSocketIo(io) {
        this.io = io;
        // Start monitoring when socket is set (or server starts)
        this.startStatsMonitoring();
    }

    // ... existing broadcast, getStatus, install, start, stop, sendCommand methods ...

    broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }

    getStatus() {
        return {
            status: this.status,
            totalMem: os.totalmem(),
            ...this.config
        };
    }

    async getAvailableVersions() {
        const cacheFile = path.join(__dirname, '../../versions_cache.json');

        // Strategy: 
        // 1. If cache file exists, serve it IMMEDIATELY (ignore expiration for instant load).
        // 2. Trigger background update to refresh cache for next time.

        let cachedVersions = null;

        // Try reading file cache first
        try {
            if (fs.existsSync(cacheFile)) {
                // console.log("Serving versions from disk cache");
                const data = fs.readFileSync(cacheFile, 'utf8');
                cachedVersions = JSON.parse(data);
                // Validate structure briefly
                if (!Array.isArray(cachedVersions)) cachedVersions = null;
            }
        } catch (e) {
            console.error("Failed to read version cache:", e.message);
        }

        // Define the fetch logic
        const fetchAndCache = () => new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': 'ObsidianPanel/1.0 (Integration)' }
            };

            // Using user-requested API for the list
            https.get('https://mc-versions-api.net/api/java', options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        // API returns { result: ["1.21.11", ...] }
                        const versions = parsed.result.map(v => ({
                            id: v,
                            type: 'release'
                        }));

                        // Save to disk
                        fs.writeFileSync(cacheFile, JSON.stringify(versions, null, 2));

                        // Update memory cache
                        versionCache = versions;
                        lastCacheTime = Date.now();

                        resolve(versions);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', (err) => reject(err));
        });

        // 1. If we have cached data, return it AND fetch in background
        if (cachedVersions) {
            // Trigger background update without awaiting
            fetchAndCache().catch(err => console.error("Background version update failed:", err.message));
            return cachedVersions;
        }

        // 2. If no cache, we MUST await the fetch
        try {
            return await fetchAndCache();
        } catch (e) {
            console.error("Critical: Failed to fetch versions and no cache available.", e);
            throw e; // Propagate error so frontend shows fallback
        }
    }

    async getPaperUrl(version) {
        return new Promise((resolve, reject) => {
            const options = { headers: { 'User-Agent': 'ObsidianPanel/1.0' } };
            // 1. Get builds
            https.get(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds`, options, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (!parsed.builds || parsed.builds.length === 0) return reject(new Error(`No Paper builds for ${version}`));

                        // Get latest build that has downloads
                        const latestBuild = parsed.builds[parsed.builds.length - 1];
                        const buildNum = latestBuild.build;
                        const fileName = latestBuild.downloads.application.name;

                        const url = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${buildNum}/downloads/${fileName}`;
                        resolve(url);
                    } catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
    }

    async getPurpurUrl(version) {
        return new Promise((resolve, reject) => {
            const options = { headers: { 'User-Agent': 'ObsidianPanel/1.0' } };
            https.get(`https://api.purpurmc.org/v2/purpur/${version}/latest/download`, options, (res) => {
                // Determine if 404 or redirect
                if (res.statusCode >= 400) return reject(new Error(`Purpur not available for ${version}`));
                // Purpur API returns the file directly or a redirect, but we need the download link.
                // Actually the endpoint IS the download link if it works.
                // But we need to handle 302 redirects? https.get usually follows if configured, but node defaults?
                // Actually easier: Purpur API documentation says /latest/download returns the file.
                // We should probably just return this URL and let the install() method handle the download/redirects.
                // Wait, our install method uses simple https.get(). 
                // Let's resolve the URL we *should* download from.
                resolve(`https://api.purpurmc.org/v2/purpur/${version}/latest/download`);
            }).on('error', reject);
        });
    }

    async getVersionDownloadUrl(version) {
        const type = this.config.type || 'vanilla';
        console.log(`Resolving download URL for ${version} [Type: ${type}]`);

        if (type === 'paper') return this.getPaperUrl(version);
        if (type === 'purpur') return this.getPurpurUrl(version);

        // Vanilla Logic (Mojang)
        // To get the download URL, we still need to look up the version in the official manifest
        // because mc-versions-api.net only gives us the ID list.
        return new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': 'ObsidianPanel/1.0 (Integration)' }
            };

            https.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const vEntry = parsed.versions.find(v => v.id === version);

                        if (!vEntry) {
                            return reject(new Error(`Version ${version} parsing info not found in Mojang manifest`));
                        }

                        // Now verify/fetch the package URL to get the actual server.jar link
                        https.get(vEntry.url, (pkgRes) => {
                            let pkgData = '';
                            pkgRes.on('data', (chunk) => pkgData += chunk);
                            pkgRes.on('end', () => {
                                try {
                                    const pkgParsed = JSON.parse(pkgData);
                                    const serverUrl = pkgParsed.downloads?.server?.url;
                                    if (!serverUrl) reject(new Error('No server download available via Mojang'));
                                    resolve(serverUrl);
                                } catch (e) { reject(e); }
                            });
                        }).on('error', (err) => reject(err));

                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', (err) => reject(err));
        });
    }

    async install(version = '1.20.4') {
        if (this.status !== 'offline') throw new Error('Server must be offline to install/update');

        this.status = 'installing';
        this.broadcast('status', this.getStatus());

        try {
            // Fetch dynamic download URL
            const downloadUrl = await this.getVersionDownloadUrl(version);

            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(this.jarFile);
                https.get(downloadUrl, (response) => {
                    const len = parseInt(response.headers['content-length'], 10);
                    let cur = 0;

                    response.pipe(file);

                    response.on('data', (chunk) => {
                        cur += chunk.length;
                        const percent = len ? (cur / len) * 100 : 0;
                        this.broadcast('install_progress', percent);
                    });

                    file.on('finish', () => {
                        file.close();
                        this.status = 'offline';
                        this.broadcast('status', this.getStatus());

                        // Auto-accept EULA
                        fs.writeFileSync(path.join(this.serverDir, 'eula.txt'), 'eula=true');

                        resolve(true);
                    });
                }).on('error', (err) => {
                    fs.unlink(this.jarFile, () => { });
                    this.status = 'offline';
                    reject(err);
                });
            });
        } catch (error) {
            this.status = 'offline';
            this.broadcast('status', this.getStatus());
            throw error;
        }
    }

    start() {
        if (this.status !== 'offline') return;
        if (!fs.existsSync(this.jarFile)) {
            throw new Error('Server JAR not found. Please install first.');
        }

        this.status = 'starting';
        this.broadcast('status', this.getStatus());

        // Parse RAM from config (e.g. "4GB" -> "4096M")
        const ramMatch = this.config.ram.match(/(\d+)(GB|MB)/);
        let maxRam = '4096M';
        if (ramMatch) {
            const val = parseInt(ramMatch[1]);
            const unit = ramMatch[2];
            maxRam = unit === 'GB' ? `${val * 1024}M` : `${val}M`;
        }

        const args = [
            '-Xms1024M',
            `-Xmx${maxRam}`,
            '-jar',
            this.jarFile,
            'nogui'
        ];

        this.process = spawn('java', args, {
            cwd: this.serverDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this.process.stdout.on('data', (data) => {
            const line = data.toString();
            this.broadcast('console_log', line);
            if (line.includes('Done') && line.includes('! For help')) {
                this.status = 'online';
                this.broadcast('status', this.getStatus());
            }
        });

        this.process.stderr.on('data', (data) => {
            this.broadcast('console_log', data.toString());
        });

        this.process.on('close', (code) => {
            this.status = 'offline';
            this.process = null;
            this.broadcast('status', this.getStatus());
            this.broadcast('console_log', `Server process exited with code ${code}`);
        });

        this.process.on('error', (err) => {
            this.status = 'offline';
            this.process = null;
            this.broadcast('status', this.getStatus());
            this.broadcast('console_log', `Failed to start server: ${err.message}`);
        });
    }

    stop() {
        if (this.status === 'offline' || !this.process) return;

        this.status = 'stopping';
        this.broadcast('status', this.getStatus());

        if (this.process.stdin.writable) {
            this.process.stdin.write('stop\n');
        } else {
            this.process.kill();
        }
    }

    sendCommand(command) {
        if (this.status === 'online' && this.process && this.process.stdin.writable) {
            this.process.stdin.write(command + '\n');
            this.broadcast('console_log', `> ${command}`);
        }
    }
}

// Singleton instance
module.exports = new MinecraftService();
