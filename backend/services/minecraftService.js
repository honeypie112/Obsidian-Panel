const ServerConfig = require('../models/ServerConfig');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const https = require('https');
const os = require('os');
const { spawn } = require('child_process');
let versionCache = null;
let lastCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 60;
class MinecraftService extends EventEmitter {
    constructor() {
        super();
        this.serverDir = path.join(__dirname, '../minecraft_server');
        this.jarFile = path.join(this.serverDir, 'server.jar');
        this.process = null;
        this.status = 'offline';
        this.logBuffer = [];
        this.config = {
            name: 'main-server',
            ram: '4GB',
            port: 25565,
            version: '1.20.4',
            type: 'vanilla',
            gofileToken: ''
        };
        this.isOperationLocked = false;
        if (!fs.existsSync(this.serverDir)) {
            fs.mkdirSync(this.serverDir, { recursive: true });
        }
    }
    async initDatabase() {
        try {
            let configDoc = await ServerConfig.findOne({ name: 'main-server' });
            if (!configDoc) {
                configDoc = await ServerConfig.create(this.config);
                console.log("Created default ServerConfig in MongoDB");
            }
            this.config = {
                name: configDoc.name,
                ram: configDoc.ram,
                version: configDoc.version,
                type: configDoc.type || 'vanilla',
                port: configDoc.port,
                gofileToken: configDoc.gofileToken || ''
            };
            console.log("Loaded ServerConfig from MongoDB:", this.config);
        } catch (err) {
            console.error("Failed to load config from DB:", err);
        }
    }
    async saveConfig(newConfig) {
        if (this.isOperationLocked) throw new Error('Operation locked: Server maintenance in progress.');
        try {
            this.config = { ...this.config, ...newConfig };
            console.log("Saving config to DB. New state:", this.config);
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
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            let storage = { total: 0, used: 0, free: 0 };
            try {
                if (fs.statfs) {
                    const stats = await fs.promises.statfs(this.serverDir);
                    storage.total = stats.bsize * stats.blocks;
                    storage.free = stats.bsize * stats.bfree;
                    storage.used = storage.total - storage.free;
                }
            } catch (e) { }
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
        this.startStatsMonitoring();
    }
    broadcast(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
    getStatus() {
        const exists = fs.existsSync(this.jarFile);
        if (!exists) {
            try {
                if (!fs.existsSync(this.jarFile) && fs.existsSync(this.serverDir)) {
                }
            } catch (e) { }
        }
        return {
            status: this.status,
            totalMem: os.totalmem(),
            isInstalled: exists,
            isLocked: this.isOperationLocked,
            ...this.config
        };
    }
    async install(version = '1.20.4') {
        if (this.isOperationLocked) throw new Error('Operation locked: Server maintenance in progress.');
        if (this.status !== 'offline') throw new Error('Server must be offline to install/update');
        this.status = 'installing';
    }
    start() {
        if (this.isOperationLocked) throw new Error('Operation locked: Server maintenance in progress.');
        if (this.status !== 'offline') return;
    }
    stop() {
        if (this.isOperationLocked) console.warn('Warning: Stop called while operation locked.');
        if (this.status === 'offline' || !this.process) return;
    }
    getLogHistory() {
        return this.logBuffer;
    }
    async getAvailableVersions() {
        const cacheFile = path.join(__dirname, '../../versions_cache.json');
        let cachedVersions = null;
        try {
            if (fs.existsSync(cacheFile)) {
                const data = fs.readFileSync(cacheFile, 'utf8');
                cachedVersions = JSON.parse(data);
                if (!Array.isArray(cachedVersions)) cachedVersions = null;
            }
        } catch (e) {
            console.error("Failed to read version cache:", e.message);
        }
        const fetchAndCache = () => new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': 'ObsidianPanel/1.0 (Integration)' }
            };
            https.get('https://mc-versions-api.net/api/java', options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const versions = parsed.result.map(v => ({
                            id: v,
                            type: 'release'
                        }));
                        fs.writeFileSync(cacheFile, JSON.stringify(versions, null, 2));
                        versionCache = versions;
                        lastCacheTime = Date.now();
                        resolve(versions);
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', (err) => reject(err));
        });
        if (cachedVersions) {
            fetchAndCache().catch(err => console.error("Background version update failed:", err.message));
            return cachedVersions;
        }
        try {
            return await fetchAndCache();
        } catch (e) {
            console.error("Critical: Failed to fetch versions and no cache available.", e);
            throw e;
        }
    }
    async getPaperUrl(version) {
        return new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': 'ObsidianPanel/1.0' },
                timeout: 5000 // 5s timeout for metadata check
            };
            const req = https.get(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds`, options, (res) => {
                if (res.statusCode === 404) {
                    return reject(new Error(`Paper version ${version} not found (404)`));
                }
                if (res.statusCode >= 400) {
                    return reject(new Error(`Paper API Error: ${res.statusCode}`));
                }

                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (!parsed.builds || parsed.builds.length === 0) {
                            return reject(new Error(`No Paper builds found for version ${version}`));
                        }

                        // Sort builds to find latest efficient way, though usually they are ordered
                        // Prefer 'default' channel if channel information is available (Paper V2 API)
                        // If logic is needed to filter stable, we can check parsed.builds[i].channel === 'default'

                        const latestBuild = parsed.builds[parsed.builds.length - 1];
                        const buildNum = latestBuild.build;
                        const fileName = latestBuild.downloads.application.name;
                        const url = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${buildNum}/downloads/${fileName}`;
                        resolve(url);
                    } catch (e) {
                        reject(new Error(`Failed to parse Paper metadata: ${e.message}`));
                    }
                });
            });

            req.on('error', (err) => reject(new Error(`Network error checking Paper: ${err.message}`)));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Paper version check timed out'));
            });
        });
    }
    async getPurpurUrl(version) {
        return new Promise((resolve, reject) => {
            const options = { headers: { 'User-Agent': 'ObsidianPanel/1.0' } };
            https.get(`https://api.purpurmc.org/v2/purpur/${version}/latest/download`, options, (res) => {
                if (res.statusCode >= 400) return reject(new Error(`Purpur not available for ${version}`));
                resolve(`https://api.purpurmc.org/v2/purpur/${version}/latest/download`);
            }).on('error', reject);
        });
    }
    async getVersionDownloadUrl(version) {
        const type = this.config.type || 'vanilla';
        console.log(`Resolving download URL for ${version} [Type: ${type}]`);
        if (type === 'paper') return this.getPaperUrl(version);
        if (type === 'purpur') return this.getPurpurUrl(version);
        return new Promise((resolve, reject) => {
            const options = {
                headers: { 'User-Agent': 'ObsidianPanel/1.0 (Integration)' },
                timeout: 10000 // 10s timeout
            };
            const req = https.get('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const vEntry = parsed.versions.find(v => v.id === version);
                        if (!vEntry) {
                            return reject(new Error(`Version ${version} parsing info not found in Mojang manifest`));
                        }
                        const pkgReq = https.get(vEntry.url, { ...options, timeout: 10000 }, (pkgRes) => {
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
                        });
                        pkgReq.on('error', (err) => reject(err));
                        pkgReq.on('timeout', () => { pkgReq.destroy(); reject(new Error('Version package fetch timed out')); });
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            req.on('error', (err) => reject(err));
            req.on('timeout', () => { req.destroy(); reject(new Error('Manifest fetch timed out')); });
        });
    }
    async install(version = '1.20.4') {
        if (this.status !== 'offline') throw new Error('Server must be offline to install/update');
        this.status = 'installing';
        this.broadcast('status', this.getStatus());

        try {
            const downloadUrl = await this.getVersionDownloadUrl(version);

            await new Promise((resolve, reject) => {
                const cleanup = (err) => {
                    // Ensure the file generic error handler doesn't trigger secondary cleanup
                    if (file) {
                        file.destroy();
                    }
                    fs.unlink(this.jarFile, () => { }); // Best effort cleanup
                    this.status = 'offline';
                    this.broadcast('status', this.getStatus());
                    reject(err);
                };

                const file = fs.createWriteStream(this.jarFile);

                file.on('error', (err) => {
                    cleanup(new Error(`File write error: ${err.message}`));
                });

                const request = https.get(downloadUrl, (response) => {
                    if (response.statusCode >= 400) {
                        cleanup(new Error(`Download failed with status code ${response.statusCode}`));
                        return;
                    }

                    const len = parseInt(response.headers['content-length'], 10);
                    let cur = 0;

                    response.pipe(file);

                    response.on('data', (chunk) => {
                        cur += chunk.length;
                        const percent = len ? (cur / len) * 100 : 0;
                        this.broadcast('install_progress', percent);
                    });

                    file.on('finish', () => {
                        file.close(() => {
                            this.status = 'offline';
                            this.broadcast('status', this.getStatus());
                            fs.writeFileSync(path.join(this.serverDir, 'eula.txt'), 'eula=true');
                            resolve(true);
                        });
                    });
                });

                request.on('error', (err) => {
                    cleanup(new Error(`Network error: ${err.message}`));
                });

                request.on('timeout', () => {
                    request.destroy();
                    cleanup(new Error('Download timed out'));
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
        // Regex to match ram string like "4GB", "4G", "1024M", "1024 MB"
        const ramMatch = this.config.ram.match(/(\d+)\s*([GgMm])[Bb]?/);
        let maxRam = '4096M';
        if (ramMatch) {
            const val = parseInt(ramMatch[1]);
            const unit = ramMatch[2].toUpperCase();
            // unit will be 'G' or 'M' due to match group 2 excluding optional 'b'
            maxRam = unit === 'G' ? `${val * 1024}M` : `${val}M`;
        }
        const args = [
            '-Xms1024M',
            `-Xmx${maxRam}`,
            '-DTerminal.jline=false',
            '-DTerminal.ansi=true',
            '-Dlog4j.skipJansi=false', // Force Log4j to recognize ANSI support
            '-jar',
            this.jarFile,
            'nogui'
        ];
        this.process = spawn('java', args, {
            cwd: this.serverDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                FORCE_COLOR: 'true'
            }
        });
        this.process.stdout.on('data', (data) => {
            const line = data.toString();
            this.pushLog(line);
            if (line.includes('Done') && line.includes('! For help')) {
                this.status = 'online';
                this.broadcast('status', this.getStatus());
            }
        });
        this.process.stderr.on('data', (data) => {
            this.pushLog(data.toString());
        });
        this.process.on('close', (code) => {
            this.status = 'offline';
            this.process = null;
            this.broadcast('status', this.getStatus());
            this.pushLog(`Server process exited with code ${code}`);
        });
        this.process.on('error', (err) => {
            this.status = 'offline';
            this.process = null;
            this.broadcast('status', this.getStatus());
            this.pushLog(`Failed to start server: ${err.message}`);
        });
    }
    pushLog(message) {
        this.broadcast('console_log', message);
        const lines = message.split('\n');
        for (let line of lines) {
            if (line.trim().length === 0) continue;
            this.logBuffer.push(line);
        }
        if (this.logBuffer.length > 1000) {
            this.logBuffer = this.logBuffer.slice(this.logBuffer.length - 1000);
        }
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
    kill() {
        if (!this.process) return;
        this.process.kill('SIGKILL');
        this.process = null;
        this.status = 'offline';
        this.broadcast('status', this.getStatus());
        this.pushLog('Server was forcefully killed.');
    }
    sendCommand(command) {
        if (this.status === 'online' && this.process && this.process.stdin.writable) {
            this.process.stdin.write(command + '\n');
            this.pushLog(`> ${command}`);
        }
    }
}
module.exports = new MinecraftService();
