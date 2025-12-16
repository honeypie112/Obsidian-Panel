import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { useToast } from '../context/ToastContext';
import StatCard from '../components/StatCard';
import { Activity, Cpu, HardDrive, MemoryStick, Play, Square, RefreshCw, Loader2 } from 'lucide-react';

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Overview = () => {
    const { server, performAction, installServer, socket } = useServer();
    const { showToast } = useToast();
    const [installing, setInstalling] = useState(false);
    const [stats, setStats] = useState({
        cpu: 0,
        cores: 0,
        ram: { total: 0, used: 0 },
        storage: { total: 0, used: 0 }
    });

    const handleStart = () => {
        if (server.isInstalled === false) {
            showToast('Please install the server JAR first!', 'error');
            return;
        }
        performAction('start');
    };
    useEffect(() => {
        if (!socket) return;
        const onStats = (data) => setStats(data);
        socket.on('stats', onStats);
        return () => socket.off('stats', onStats);
    }, [socket]);
    const handleReinstall = async () => {
        if (!server.version) return;
        try {
            await installServer(server.version);
        } catch (error) {
            console.error("Reinstall failed:", error);
        }
    };
    if (!server) return <div className="text-white">Loading...</div>;
    const isOnline = server.status === 'online';
    const isInstalling = server.status === 'installing';
    const ramPercent = stats.ram.total > 0 ? (stats.ram.used / stats.ram.total) * 100 : 0;
    const storagePercent = stats.storage.total > 0 ? (stats.storage.used / stats.storage.total) * 100 : 0;
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Server Overview</h1>
                    <p className="text-obsidian-muted">Manage and monitor your Minecraft server instance.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <span className={`inline-flex h-3 w-3 rounded-full ${server.status === 'online' ? 'bg-green-500' :
                        server.status === 'starting' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}></span>
                    <span className="text-white font-medium capitalize">{server.status}</span>
                </div>
            </div>
            { }
            {server.isInstalled === false && server.status === 'offline' && (
                <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6 flex justify-between items-center">
                    <div>
                        <h3 className="text-white font-bold text-lg mb-1">Server Not Installed</h3>
                        <p className="text-obsidian-muted text-sm">Server JAR not found. Please install to start.</p>
                    </div>
                    <button
                        onClick={handleReinstall}
                        className="bg-obsidian-surface hover:bg-white/5 border border-obsidian-border text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                    >
                        <RefreshCw size={16} className="mr-2" />
                        Install Server
                    </button>
                </div>
            )}
            {isInstalling && (
                <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6 text-center">
                    <Loader2 size={32} className="text-obsidian-accent animate-spin mx-auto mb-3" />
                    <h3 className="text-white font-bold text-lg">Installing Server...</h3>
                    <p className="text-obsidian-muted">Please wait while the server files are downloaded.</p>
                </div>
            )}
            { }
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Status"
                    value={server.status}
                    subtext={isOnline ? "Running" : "Stopped"}
                    icon={Activity}
                    color="text-blue-400"
                />
                <StatCard
                    title="CPU Usage"
                    value={`${stats.cpu}%`}
                    subtext={`${stats.cores} Cores`}
                    icon={Cpu}
                    color="text-obsidian-accent"
                />
                <StatCard
                    title="RAM Usage"
                    value={formatBytes(stats.ram.used)}
                    subtext={`of ${formatBytes(stats.ram.total)} (${Math.round(ramPercent)}%)`}
                    icon={MemoryStick}
                    color="text-purple-400"
                />
                <StatCard
                    title="Storage"
                    value={formatBytes(stats.storage.used)}
                    subtext={`of ${formatBytes(stats.storage.total)} Used`}
                    icon={HardDrive}
                    color="text-green-400"
                />
            </div>
            { }
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h3 className="text-white font-bold mb-4">Power Controls</h3>
                <div className="flex space-x-4">
                    <button
                        onClick={handleStart}
                        disabled={isOnline || isInstalling || server.status === 'stopping'}
                        className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-500 border border-green-500/20 py-3 rounded-lg font-medium transition-colors flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play size={18} className="mr-2" /> Start
                    </button>
                    <button
                        onClick={() => performAction('restart')}
                        disabled={!isOnline || isInstalling}
                        className="flex-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 border border-yellow-500/20 py-3 rounded-lg font-medium transition-colors flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={18} className="mr-2" /> Restart
                    </button>
                    <button
                        onClick={() => performAction('stop')}
                        disabled={!isOnline || isInstalling}
                        className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-3 rounded-lg font-medium transition-colors flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Square size={18} className="mr-2 fill-current" /> Stop
                    </button>
                </div>
            </div>
        </div>
    );
};
export default Overview;
