const pty = require('node-pty');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const pidusage = require('pidusage');
const Server = require('../models/Server');

class ServerManager {
    constructor(io) {
        this.io = io;
        this.processes = new Map(); // serverId -> process
        this.logs = new Map(); // serverId -> Array<{type, data}>
        this.statsInterval = null;
        this.startStatsMonitoring();
        this.recoverRunningServers();
    }

    async recoverRunningServers() {
        console.log('🔄 Attempting to recover running servers...');
        try {
            const onlineServers = await Server.find({ status: { $in: ['online', 'starting'] } });

            for (const server of onlineServers) {
                if (server.pid) {
                    try {
                        // Check if process is actually running
                        process.kill(server.pid, 0);

                        console.log(`✅ Found running server ${server.name} (PID: ${server.pid}). Recovering...`);

                        // Create a "recovered" process object
                        // We can't restore stdin (commands), but we can monitor and stop it
                        const recoveredProcess = {
                            pid: server.pid,
                            killed: false,
                            stdin: null, // Cannot write to stdin of recovered process
                            stdout: null,
                            stderr: null,
                            recovered: true // Flag to indicate this is a recovered process
                        };

                        this.processes.set(server._id.toString(), recoveredProcess);

                        // Restore log streaming using 'tail'
                        this.streamLogsFromFile(server._id.toString(), server.directory);

                    } catch (e) {
                        // Process not found
                        console.log(`⚠️ Server ${server.name} (PID: ${server.pid}) is not running. Marking as offline.`);
                        server.status = 'offline';
                        server.pid = null;
                        server.activePlayers = 0;
                        await server.save();
                        this.io.to(server._id.toString()).emit('serverStatus', { status: 'offline', serverId: server._id });
                    }
                } else {
                    // No PID, mark offline
                    server.status = 'offline';
                    await server.save();
                }
            }
        } catch (error) {
            console.error('❌ Failed to recover servers:', error);
        }
    }

    streamLogsFromFile(serverId, serverDir) {
        const logPath = path.join(serverDir, 'logs', 'latest.log');

        // Check if log file exists
        fs.access(logPath)
            .then(() => {
                // Spawn tail process to follow log file
                const tail = spawn('tail', ['-f', '-n', '100', logPath]);

                tail.stdout.on('data', (data) => {
                    this.addToLog(serverId, 'stdout', data.toString());
                });

                tail.stderr.on('data', (data) => {
                    // tail errors
                    console.error(`[Tail ${serverId}] Error:`, data.toString());
                });

                tail.on('error', (error) => {
                    console.error(`[Tail ${serverId}] Failed to spawn tail process:`, error);
                });

                // Store tail process to kill it later
                const proc = this.processes.get(serverId);
                if (proc) {
                    proc.tailProcess = tail;
                }
            })
            .catch(() => {
                console.log(`[Server ${serverId}] No log file found at ${logPath}`);
            });
    }

    async startServer(serverId) {
        try {
            const server = await Server.findById(serverId);
            if (!server) throw new Error('Server not found');

            // Check if process exists in memory AND is actually running
            const existingProcess = this.processes.get(serverId);
            if (existingProcess && !existingProcess.killed) {
                throw new Error('Server already running');
            }

            // Clean up stale reference if process is dead
            if (existingProcess && existingProcess.killed) {
                this.processes.delete(serverId);
            }

            // Update status to starting
            server.status = 'starting';
            await server.save();

            // Ensure server directory exists
            await fs.mkdir(server.directory, { recursive: true });

            // Check if server.jar exists
            const jarPath = path.join(server.directory, 'server.jar');
            try {
                await fs.access(jarPath);
            } catch {
                throw new Error('server.jar not found. Please upload a Minecraft server JAR file.');
            }

            // Accept EULA
            const eulaPath = path.join(server.directory, 'eula.txt');
            await fs.writeFile(eulaPath, 'eula=true');

            // Spawn Minecraft server process using node-pty
            const javaProcess = pty.spawn('java', [
                `-Xmx1024M`, // Temporarily forced to 1024M for debugging
                `-Xms1024M`,
                '-jar',
                'server.jar',
                'nogui',
                `--port=${server.port}`,
            ], {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: server.directory,
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    HOME: server.directory
                }
            });

            this.processes.set(serverId, javaProcess);

            // Store PID
            server.pid = javaProcess.pid;
            server.status = 'online';
            await server.save();
            this.io.to(serverId).emit('serverStatus', { status: 'online', serverId });

            // Handle output (stdout and stderr are merged in pty)
            javaProcess.on('data', (data) => {
                const output = data.toString();
                // Debug: Print server output to backend console
                process.stdout.write(`[MC-${serverId}] ${output}`);

                this.addToLog(serverId, 'stdout', output);

                // Parse player count from logs
                this.parsePlayerCount(serverId, output);
            });

            // Handle pty errors
            javaProcess.on('error', (err) => {
                console.error(`[Server ${serverId}] PTY Error:`, err);
                this.addToLog(serverId, 'stderr', `\n❌ PTY Error: ${err.message}\n`);
            });

            // Handle process exit
            javaProcess.on('exit', async (code) => {
                console.log(`Server ${serverId} exited with code ${code}`);
                this.processes.delete(serverId);

                // Emit exit message to console
                if (code !== 0) {
                    this.addToLog(serverId, 'stderr', `\n❌ Server exited with code ${code}\nCommon issues:\n- server.jar is missing (use "Download Server JAR" button)\n- Java is not installed\n- Not enough memory allocated\n- Check console output above for errors\n`);
                }

                const srv = await Server.findById(serverId);
                if (srv) {
                    srv.status = 'offline';
                    srv.pid = null;
                    srv.activePlayers = 0;
                    await srv.save();
                }

                this.io.to(serverId).emit('serverStatus', { status: 'offline', serverId });
            });

            return { success: true, message: 'Server started successfully' };
        } catch (error) {
            const server = await Server.findById(serverId);
            if (server) {
                server.status = 'offline';
                await server.save();
            }
            throw error;
        }
    }

    async stopServer(serverId) {
        try {
            const proc = this.processes.get(serverId);
            if (!proc) {
                throw new Error('Server not running');
            }

            const server = await Server.findById(serverId);
            server.status = 'stopping';
            await server.save();

            // Stop tail process if exists
            if (proc.tailProcess) {
                proc.tailProcess.kill();
            }

            if (proc.recovered) {
                // Recovered process: no stdin, use signals
                console.log(`Stopping recovered server ${serverId} (PID: ${proc.pid}) via SIGTERM`);
                try {
                    process.kill(proc.pid, 'SIGTERM');
                } catch (e) {
                    console.error('Failed to kill process:', e);
                }
            } else {
                // Normal process: send stop command
                // node-pty process has .write() method directly
                if (typeof proc.write === 'function') {
                    proc.write('stop\n');
                } else if (proc.stdin) {
                    // Fallback for standard child_process if ever mixed
                    proc.stdin.write('stop\n');
                }
            }

            // Force kill after 30 seconds if still running
            setTimeout(() => {
                if (this.processes.has(serverId)) {
                    try {
                        process.kill(proc.pid, 'SIGKILL');
                    } catch (e) {
                        // ignore if already dead
                    }
                }
            }, 30000);

            return { success: true, message: 'Server stopping...' };
        } catch (error) {
            throw error;
        }
    }

    async sendCommand(serverId, command) {
        try {
            const proc = this.processes.get(serverId);
            if (!proc) {
                throw new Error('Server not running');
            }

            if (proc.recovered) {
                throw new Error('Cannot send commands to a recovered server. Please restart the server to regain full control.');
            }

            // node-pty uses .write()
            if (typeof proc.write === 'function') {
                proc.write(command + '\n');
            } else if (proc.stdin) {
                proc.stdin.write(command + '\n');
            }

            return { success: true, message: 'Command sent' };
        } catch (error) {
            throw error;
        }
    }

    // ... (parsePlayerCount and updatePlayerCount remain same) ...

    parsePlayerCount(serverId, logLine) {
        // Match patterns like "Player joined" or "Player left"
        const joinPattern = /(\w+) joined the game/;
        const leavePattern = /(\w+) left the game/;

        if (joinPattern.test(logLine) || leavePattern.test(logLine)) {
            // Update player count (simplified, in production use more robust parsing)
            this.updatePlayerCount(serverId);
        }
    }

    async updatePlayerCount(serverId) {
        // In production, parse "list" command output
        // For now, send list command and handle response
        try {
            const proc = this.processes.get(serverId);
            if (proc && !proc.recovered) {
                if (typeof proc.write === 'function') {
                    proc.write('list\n');
                } else if (proc.stdin) {
                    proc.stdin.write('list\n');
                }
            }
        } catch (error) {
            console.error('Error updating player count:', error);
        }
    }

    startStatsMonitoring() {
        // Update CPU/RAM stats every 5 seconds
        this.statsInterval = setInterval(async () => {
            for (const [serverId, proc] of this.processes.entries()) {
                try {
                    const server = await Server.findById(serverId);
                    if (!server || !proc.pid) continue;

                    // Check if process is still alive
                    try {
                        process.kill(proc.pid, 0);
                    } catch (e) {
                        // Process is dead
                        this.handleProcessExit(serverId, proc, 1); // Treat as unexpected exit
                        continue;
                    }

                    // Get real CPU and RAM usage using pidusage
                    console.log(`[Stats] Monitoring PID ${proc.pid} for server ${serverId}`);
                    const stats = await pidusage(proc.pid);
                    console.log(`[Stats] Raw stats for ${serverId}:`, stats);

                    // CPU percentage (0-100)
                    server.cpuUsage = Math.min(stats.cpu, 100);

                    // RAM percentage (current memory / allocated memory * 100)
                    const memoryMB = stats.memory / 1024 / 1024; // Convert bytes to MB
                    server.ramUsage = Math.min((memoryMB / server.memory) * 100, 100);

                    await server.save();

                    this.io.to(serverId).emit('stats', {
                        cpu: server.cpuUsage,
                        ram: server.ramUsage,
                        players: server.activePlayers,
                    });
                } catch (error) {
                    console.error(`[Stats Error] Server ${serverId} (PID ${proc?.pid}):`, error);
                }
            }
        }, 5000);
    }

    addToLog(serverId, type, data) {
        if (!this.logs.has(serverId)) {
            this.logs.set(serverId, []);
        }

        const serverLogs = this.logs.get(serverId);
        serverLogs.push({ type, data });

        // Keep last 200 lines
        if (serverLogs.length > 200) {
            serverLogs.shift();
        }

        this.io.to(serverId).emit('console', { type, data });
    }

    getLogs(serverId) {
        return this.logs.get(serverId) || [];
    }

    async handleProcessExit(serverId, proc, code) {
        console.log(`Server ${serverId} exited with code ${code}`);
        this.processes.delete(serverId);

        if (proc.tailProcess) {
            proc.tailProcess.kill();
        }

        // Emit exit message to console
        if (code !== 0 && code !== null) { // null code usually means killed by signal
            this.addToLog(serverId, 'stderr', `\n❌ Server exited with code ${code}\n`);
        } else {
            this.addToLog(serverId, 'stdout', `\nℹ️ Server stopped.\n`);
        }

        const srv = await Server.findById(serverId);
        if (srv) {
            srv.status = 'offline';
            srv.pid = null;
            srv.activePlayers = 0;
            await srv.save();
        }

        this.io.to(serverId).emit('serverStatus', { status: 'offline', serverId });
    }

    cleanup() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }

        // Stop all servers gracefully
        for (const [serverId, proc] of this.processes.entries()) {
            if (proc.tailProcess) {
                proc.tailProcess.kill();
            }

            if (proc.recovered) {
                try { process.kill(proc.pid, 'SIGTERM'); } catch (e) { }
            } else {
                if (typeof proc.write === 'function') {
                    proc.write('stop\n');
                } else if (proc.stdin) {
                    proc.stdin.write('stop\n');
                }
            }
        }
    }
}

module.exports = ServerManager;
