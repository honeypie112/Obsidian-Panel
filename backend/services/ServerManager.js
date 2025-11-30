const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const pidusage = require('pidusage');
const Server = require('../models/Server');

class ServerManager {
    constructor(io) {
        this.io = io;
        this.processes = new Map(); // serverId -> process
        this.statsInterval = null;
        this.startStatsMonitoring();
        this.syncDatabaseState();
    }

    async syncDatabaseState() {
        // Reset all servers to offline on startup (in case of crash/restart)
        try {
            await Server.updateMany(
                { status: { $in: ['online', 'starting', 'stopping'] } },
                { status: 'offline', pid: null }
            );
            console.log('✅ Synced server states to database');
        } catch (error) {
            console.error('❌ Failed to sync database state:', error);
        }
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

            // Spawn Minecraft server process
            const javaProcess = spawn('java', [
                `-Xmx${server.memory}M`,
                `-Xms${server.memory}M`,
                '-jar',
                'server.jar',
                'nogui',
                `--port=${server.port}`,
            ], {
                cwd: server.directory,
            });

            this.processes.set(serverId, javaProcess);

            // Store PID
            server.pid = javaProcess.pid;
            server.status = 'online';
            await server.save();

            // Handle stdout
            javaProcess.stdout.on('data', (data) => {
                const output = data.toString();
                this.io.to(serverId).emit('console', { type: 'stdout', data: output });

                // Parse player count from logs
                this.parsePlayerCount(serverId, output);
            });

            // Handle stderr
            javaProcess.stderr.on('data', (data) => {
                const output = data.toString();
                this.io.to(serverId).emit('console', { type: 'stderr', data: output });
                console.error(`[Server ${serverId}] Error:`, output);
            });

            // Handle process errors
            javaProcess.on('error', async (error) => {
                console.error(`Server ${serverId} process error:`, error);
                this.io.to(serverId).emit('console', {
                    type: 'stderr',
                    data: `\n❌ Failed to start server: ${error.message}\nPlease ensure Java is installed and server.jar exists.\n`
                });

                const srv = await Server.findById(serverId);
                if (srv) {
                    srv.status = 'offline';
                    srv.pid = null;
                    await srv.save();
                }
            });

            // Handle process exit
            javaProcess.on('exit', async (code) => {
                console.log(`Server ${serverId} exited with code ${code}`);
                this.processes.delete(serverId);

                // Emit exit message to console
                if (code !== 0) {
                    this.io.to(serverId).emit('console', {
                        type: 'stderr',
                        data: `\n❌ Server exited with code ${code}\nCommon issues:\n- server.jar is missing (use "Download Server JAR" button)\n- Java is not installed\n- Not enough memory allocated\n- Check console output above for errors\n`
                    });
                }

                const srv = await Server.findById(serverId);
                if (srv) {
                    srv.status = 'offline';
                    srv.pid = null;
                    srv.activePlayers = 0;
                    await srv.save();
                }

                this.io.to(serverId).emit('serverStatus', { status: 'offline' });
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
            const process = this.processes.get(serverId);
            if (!process) {
                throw new Error('Server not running');
            }

            const server = await Server.findById(serverId);
            server.status = 'stopping';
            await server.save();

            // Send stop command to Minecraft server
            process.stdin.write('stop\n');

            // Force kill after 30 seconds if still running
            setTimeout(() => {
                if (this.processes.has(serverId)) {
                    process.kill('SIGKILL');
                }
            }, 30000);

            return { success: true, message: 'Server stopping...' };
        } catch (error) {
            throw error;
        }
    }

    async sendCommand(serverId, command) {
        try {
            const process = this.processes.get(serverId);
            if (!process) {
                throw new Error('Server not running');
            }

            process.stdin.write(command + '\n');
            return { success: true, message: 'Command sent' };
        } catch (error) {
            throw error;
        }
    }

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
            const process = this.processes.get(serverId);
            if (process) {
                process.stdin.write('list\n');
            }
        } catch (error) {
            console.error('Error updating player count:', error);
        }
    }

    startStatsMonitoring() {
        // Update CPU/RAM stats every 5 seconds
        this.statsInterval = setInterval(async () => {
            for (const [serverId, process] of this.processes.entries()) {
                try {
                    const server = await Server.findById(serverId);
                    if (!server || !process.pid) continue;

                    // Get real CPU and RAM usage using pidusage
                    const stats = await pidusage(process.pid);

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
                    // Process might not exist yet or has exited
                    if (error.code !== 'ENOENT') {
                        console.error('Stats update error:', error);
                    }
                }
            }
        }, 5000);
    }

    cleanup() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }

        // Stop all servers gracefully
        for (const [serverId, process] of this.processes.entries()) {
            process.stdin.write('stop\n');
        }
    }
}

module.exports = ServerManager;
