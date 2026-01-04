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
        this.serverDir = process.env.MC_SERVER_BASE_PATH
            ? path.resolve(process.env.MC_SERVER_BASE_PATH)
            : path.join(__dirname, '../minecraft_server');

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
            gofileToken: '',
            javaVersion: 21 // Default to Java 21
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
                gofileToken: configDoc.gofileToken || '',
                javaVersion: configDoc.javaVersion || 21
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
            // Ensure javaVersion is an integer
            if (this.config.javaVersion) this.config.javaVersion = parseInt(this.config.javaVersion);

            await ServerConfig.updateOne({ name: 'main-server' }, this.config, { upsert: true });
            console.log("Saved config to MongoDB");
            this.broadcast('status', this.getStatus());
        } catch (err) {
            console.error("Failed to save config to DB:", err);
            throw err;
        }
    }

    async getNetworkStats() {
        try {
            const data = await fs.promises.readFile('/proc/net/dev', 'utf8');
            const lines = data.split('\n');

            let totalRx = 0;
            let totalTx = 0;
            let found = false;

            for (const line of lines) {
                if (!line.includes(':')) continue;

                const parts = line.split(':');
                const iface = parts[0].trim();
                const stats = parts[1].trim();

                // Skip loopback, docker virtual interfaces, and veth pairs usually used for containers
                if (iface === 'lo' || iface.startsWith('docker') || iface.startsWith('veth') || iface.startsWith('br-')) continue;

                const numbers = stats.match(/(\d+)/g);
                if (numbers && numbers.length >= 9) {
                    totalRx += parseInt(numbers[0], 10);
                    totalTx += parseInt(numbers[8], 10);
                    found = true;
                }
            }

            if (!found) return null;

            return {
                rx: totalRx,
                tx: totalTx,
                timestamp: Date.now()
            };
        } catch (e) {
            console.error("Network stats error:", e.message);
            return null;
        }
    }

    startStatsMonitoring() {
        if (this.statsInterval) clearInterval(this.statsInterval);
        let previousCpus = os.cpus();
        this.lastNetStat = null;

        this.statsInterval = setInterval(async () => {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            let storage = { total: 0, used: 0, free: 0 };

            // Network Stats Calculation
            let netSpeed = { rx: 0, tx: 0 };
            const currentNet = await this.getNetworkStats();
            if (currentNet && this.lastNetStat) {
                const deltaMs = currentNet.timestamp - this.lastNetStat.timestamp;
                if (deltaMs > 0) {
                    const deltaRx = currentNet.rx - this.lastNetStat.rx;
                    const deltaTx = currentNet.tx - this.lastNetStat.tx;
                    // Bytes per second
                    netSpeed.rx = Math.max(0, Math.floor((deltaRx / deltaMs) * 1000));
                    netSpeed.tx = Math.max(0, Math.floor((deltaTx / deltaMs) * 1000));
                }
            }
            this.lastNetStat = currentNet;

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
                storage: storage,
                network: netSpeed
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
        return {
            status: this.status,
            totalMem: os.totalmem(),
            isInstalled: exists,
            isLocked: this.isOperationLocked,
            ...this.config
        };
    }

    getLogHistory() {
        return this.logBuffer;
    }

    async getAvailableVersions() {
        const cacheFile = path.join(os.tmpdir(), 'obsidian_versions_cache.json');
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
                timeout: 5000
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
                timeout: 10000
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
                    if (file) {
                        file.destroy();
                    }
                    fs.unlink(this.jarFile, () => { });
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
        }
    }
    async verifyJavaVersion(javaPath, expectedVersion) {
        return new Promise((resolve) => {
            const { spawn } = require('child_process');
            const proc = spawn(javaPath, ['-version']);
            let output = '';

            proc.stderr.on('data', (d) => output += d.toString());
            proc.stdout.on('data', (d) => output += d.toString());

            proc.on('close', () => {
                // Parse version "1.8.0_392" or "17.0.9"
                // Match patterns like: version "1.8 or version "17
                let actualVersion = null;
                const match = output.match(/version "(\d+)(?:\.(\d+))?/);
                if (match) {
                    const major = parseInt(match[1]);
                    // If major is 1 (e.g. 1.8), take minor (8). Else take major (17, 21).
                    actualVersion = major === 1 ? parseInt(match[2]) : major;
                }

                if (actualVersion === expectedVersion) {
                    console.log(`[JavaExecutable] Verified ${javaPath} is Java ${expectedVersion}`);
                    resolve(true);
                } else {
                    console.warn(`[JavaExecutable] Version mismatch: ${javaPath} is Java ${actualVersion}, expected ${expectedVersion}`);
                    resolve(false);
                }
            });

            proc.on('error', () => resolve(false));
        });
    }

    async scanJvmDirectory(version) {
        const jvmDir = '/usr/lib/jvm';
        if (!fs.existsSync(jvmDir)) return null;

        try {
            const entries = await fs.promises.readdir(jvmDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const name = entry.name;
                const vStr = version.toString();
                // Match "java-8", "java-1.8", "java-17", "jdk-17" etc.
                const patterns = [
                    `java-${vStr}`,
                    `java-1.${vStr}`,
                    `jdk-${vStr}`,
                    `jdk-1.${vStr}`
                ];

                const isMatch = patterns.some(p => name.includes(p));
                if (isMatch) {
                    const javaPath = path.join(jvmDir, name, 'bin/java');
                    if (fs.existsSync(javaPath)) {
                        // Verify it
                        const verified = await this.verifyJavaVersion(javaPath, version);
                        if (verified) return javaPath;
                    }
                }
            }
        } catch (e) {
            console.error("Error scanning JVM directory:", e);
        }
        return null;
    }

    async getJavaExecutable(version) {
        console.log(`[JavaExecutable] Resolving java binary for version: ${version}`);
        const v = parseInt(version);

        // Strategy 1: Environment Variables (Highest Priority)
        const envVar = `JAVA_${v}_HOME`;
        if (process.env[envVar]) {
            const envPath = path.join(process.env[envVar], 'bin/java');
            if (fs.existsSync(envPath)) {
                if (await this.verifyJavaVersion(envPath, v)) {
                    console.log(`[JavaExecutable] ✓ Found via ${envVar}: ${envPath}`);
                    return envPath;
                }
            }
        }

        // Strategy 2: JVM Directory Scan (Smart Scan)
        const scannedPath = await this.scanJvmDirectory(v);
        if (scannedPath) {
            console.log(`[JavaExecutable] ✓ Found via JVM Scan: ${scannedPath}`);
            return scannedPath;
        }

        // Strategy 3: Hardcoded Fallback
        const paths = {
            8: ['/usr/lib/jvm/java-1.8-openjdk/bin/java', '/usr/lib/jvm/java-8-openjdk/bin/java'],
            17: ['/usr/lib/jvm/java-17-openjdk/bin/java'],
            21: ['/usr/lib/jvm/java-21-openjdk/bin/java']
        };

        if (paths[v]) {
            for (const javaPath of paths[v]) {
                if (fs.existsSync(javaPath)) {
                    if (await this.verifyJavaVersion(javaPath, v)) {
                        console.log(`[JavaExecutable] ✓ Found via fallback: ${javaPath}`);
                        return javaPath;
                    }
                }
            }
        }

        console.warn(`[JavaExecutable] Could not resolve specific binary for version ${version}.`);
        return null; // Let the caller fail or try default 'java'
    }

    async start() {
        if (this.status !== 'offline') return;
        if (!fs.existsSync(this.jarFile)) {
            throw new Error('Server JAR not found. Please install first.');
        }
        this.status = 'starting';
        this.broadcast('status', this.getStatus());

        const selectedVersion = parseInt(this.config.javaVersion || 21);
        const javaCmd = await this.getJavaExecutable(selectedVersion);

        this.pushLog(`[System] Checking for Java ${selectedVersion}...`);

        if (!javaCmd) {
            const errorMsg = `[System] CRITICAL: Java ${selectedVersion} binary NOT FOUND on this system!`;
            console.error(`[Start] Fatal: ${errorMsg}`);
            this.pushLog(errorMsg);
            this.pushLog(`[System] Server launch aborted.`);
            this.status = 'offline';
            this.broadcast('status', this.getStatus());
            throw new Error(`Java ${selectedVersion} binary not found.`);
        }

        console.log(`[Start] Using Java executable: ${javaCmd}`);
        this.pushLog(`[System] Found Java ${selectedVersion} at: ${javaCmd}`);
        this.pushLog(`[System] Verifying Java version...`);

        // Run java -version to log exact details to user
        try {
            const { spawnSync } = require('child_process');
            const vCheck = spawnSync(javaCmd, ['-version']);
            // java -version output usually goes to stderr
            const vOutput = vCheck.stderr.toString() || vCheck.stdout.toString();
            this.pushLog('--- Java Version Check ---');
            vOutput.split('\n').forEach(line => {
                if (line.trim()) this.pushLog(`[Java] ${line}`);
            });
            this.pushLog('--------------------------');
        } catch (vErr) {
            console.error("Version check failed:", vErr);
            this.pushLog(`[System] Warning: Could not verify java version: ${vErr.message}`);
        }

        this.pushLog(`[System] Starting server subprocess...`);

        // Safety check: Ensure file is actually executable by the process
        try {
            fs.accessSync(javaCmd, fs.constants.X_OK);
            console.log(`[Start] Pre-spawn check: File is executable.`);
        } catch (accErr) {
            const accMsg = `[System] CRITICAL: File at ${javaCmd} is not executable! Permission denied?`;
            console.error(accMsg, accErr);
            this.pushLog(accMsg);
            throw new Error(`Java binary at ${javaCmd} is not executable.`);
        }

        console.log(`[Start] FINAL SPAWN CALL: ${javaCmd}`);

        // Regex to match ram string like "4GB", "4G", "1024M", "1024 MB"
        const ramMatch = this.config.ram.match(/(\d+)\s*([GgMm])[Bb]?/);
        let maxRam = '4096M';
        if (ramMatch) {
            const val = parseInt(ramMatch[1]);
            const unit = ramMatch[2].toUpperCase();
            maxRam = unit === 'G' ? `${val * 1024}M` : `${val}M`;
        }
        const args = [
            '-Xms1024M',
            `-Xmx${maxRam}`,
            '-DTerminal.jline=false',
            '-DTerminal.ansi=true',
            '-Dlog4j.skipJansi=false',
            '-jar',
            this.jarFile,
            'nogui'
        ];

        // Spawn directly using the resolved path to the java binary
        this.process = spawn(javaCmd, args, {
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
            this.status = 'offline';
            this.broadcast('status', this.getStatus());
            this.emit('stopped'); // Emit stopped event
            this.pushLog(`Server process exited with code ${code}`);
        });
        this.process.on('error', (err) => {
            this.status = 'offline';
            this.process = null;
            this.broadcast('status', this.getStatus());
            this.emit('stopped'); // Emit stopped event
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

    async restart() {
        if (this.status === 'offline') {
            return this.start();
        }

        if (this.status === 'stopping') {
            // Already stopping, just wait
        } else {
            this.stop();
        }

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Restart timed out waiting for server to stop'));
            }, 60000); // 60s timeout

            this.once('stopped', async () => {
                clearTimeout(timeout);
                try {
                    // Slight delay to ensure file locks are released
                    await new Promise(r => setTimeout(r, 1000));
                    this.start();
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        });
    }
}
module.exports = new MinecraftService();
