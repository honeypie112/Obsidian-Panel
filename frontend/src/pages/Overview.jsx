import React, { useState } from 'react';
import { useServer } from '../context/ServerContext';
import StatCard from '../components/StatCard';
import PowerControls from '../components/PowerControls';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';

const Overview = () => {
    const { server, updateServer } = useServer();

    // Mock state updates for simulation
    const [serverState, setServerState] = useState(server?.status || 'offline');

    // Sync local state with context when server changes
    React.useEffect(() => {
        if (server) {
            setServerState(server.status);
        }
    }, [server]);

    const handleStart = async () => {
        setServerState('starting');
        await new Promise(resolve => setTimeout(resolve, 3000));
        setServerState('online');
        updateServer({ status: 'online' });
    };

    const handleStop = async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        setServerState('offline');
        updateServer({ status: 'offline' });
    };

    const handleRestart = async () => {
        await handleStop();
        await handleStart();
    };

    // Simulate fluctuating stats
    const [stats, setStats] = useState({ cpu: 0, ram: 0 });

    React.useEffect(() => {
        if (serverState !== 'online') {
            setStats({ cpu: 0, ram: 0 });
            return;
        }

        // Initial stats
        setStats({
            cpu: server?.cpuUsage || 12,
            ram: server?.ramUsage || 2.1
        });

        const interval = setInterval(() => {
            setStats(prev => ({
                cpu: Math.max(0, Math.min(100, parseFloat(prev.cpu) + (Math.random() * 10 - 5))).toFixed(1),
                ram: Math.max(0, Math.min(parseFloat(server.ram), parseFloat(prev.ram) + (Math.random() * 0.2 - 0.1))).toFixed(2)
            }));
        }, 2000);

        return () => clearInterval(interval);
    }, [serverState, server]);

    if (!server) return <div className="text-white">Loading server...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-1">{server.name}</h1>
                    <div className="flex items-center space-x-2 text-sm">
                        <span className={`w-2 h-2 rounded-full ${serverState === 'online' ? 'bg-green-500' : serverState === 'starting' ? 'bg-yellow-500' : 'bg-red-500'}`}></span>
                        <span className="text-obsidian-muted capitalize">{serverState}</span>
                        <span className="text-obsidian-border">|</span>
                        <span className="text-obsidian-muted">{server.version}</span>
                        <span className="text-obsidian-border">|</span>
                        <span className="text-obsidian-muted">Port: {server.port}</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title="CPU Usage"
                    value={serverState === 'online' ? `${stats.cpu}%` : '0%'}
                    subtext="2 Cores Allocated"
                    icon={Cpu}
                    color="blue"
                />
                <StatCard
                    title="RAM Usage"
                    value={serverState === 'online' ? `${stats.ram} GB` : '0 GB'}
                    subtext={`of ${server.ram}`}
                    icon={MemoryStick}
                    color="purple"
                />
                <StatCard
                    title="Storage"
                    value={`${server.storageUsed} / ${server.storageTotal}`}
                    subtext="SSD NVMe"
                    icon={HardDrive}
                    color="green"
                />
            </div>

            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h3 className="text-lg font-bold text-white mb-4">Power Controls</h3>
                <PowerControls
                    status={serverState}
                    onStart={handleStart}
                    onStop={handleStop}
                    onRestart={handleRestart}
                />
            </div>
        </div>
    );
};

export default Overview;
