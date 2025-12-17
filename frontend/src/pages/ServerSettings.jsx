import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { Save, Download, AlertCircle, Settings, Play, RefreshCw, Square } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
import Select from '../components/Select';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

const generateRamOptions = (totalBytes) => {
    const totalGB = Math.floor(totalBytes / (1024 * 1024 * 1024));
    const options = [1, 2, 4, 8, 16, 32, 64].filter(gb => gb < totalGB);
    if (!options.includes(totalGB) && totalGB > 0) {
        options.push(totalGB);
    }
    return options.sort((a, b) => a - b);
};

const serverTypes = [
    { value: 'vanilla', label: 'Vanilla Minecraft' },
    { value: 'paper', label: 'Paper (Performance)' },
    { value: 'spigot', label: 'Spigot' },
    { value: 'forge', label: 'Forge (Modding)' },
    { value: 'fabric', label: 'Fabric (Modding)' },
];

const parseRam = (ramStr) => {
    if (!ramStr) return 1024;
    if (typeof ramStr === 'number') return ramStr;
    const match = ramStr.match(/(\d+)([GMgm])/);
    if (!match) return 1024;
    const val = parseInt(match[1]);
    const unit = match[2].toUpperCase();
    return unit === 'G' ? val * 1024 : val;
};

const formatRam = (ramMB) => {
    if (ramMB % 1024 === 0) return `${ramMB / 1024}G`;
    return `${ramMB}M`;
};

const ServerSettings = () => {
    const { server, updateServer, loading, installServer, socket } = useServer();
    const { showToast } = useToast();

    const [name, setName] = useState('');
    const [ram, setRam] = useState('2G');
    const [type, setType] = useState('vanilla');
    const [gofileToken, setGofileToken] = useState('');
    const [version, setVersion] = useState('');

    const [availableVersions, setAvailableVersions] = useState([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateStatus, setUpdateStatus] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmUpdateOpen, setIsConfirmUpdateOpen] = useState(false);

    const [totalRamMB, setTotalRamMB] = useState(16384);

    useEffect(() => {
        if (server) {
            setName(server.name || '');
            setRam(server.ram || '2G');
            setType(server.type || 'vanilla');
            setGofileToken(server.gofileToken || '');
            if (server.version) setVersion(server.version);
            if (server.totalMem) {
                setTotalRamMB(Math.floor(server.totalMem / (1024 * 1024)));
            }
        }
    }, [server]);

    useEffect(() => {
        if (!socket) return;
        let timeoutId;
        setIsLoadingVersions(true);
        console.log("Emitting get_versions...");
        socket.emit('get_versions');

        const onVersionsList = (versions) => {
            console.log("Received versions payload:", versions);
            if (timeoutId) clearTimeout(timeoutId);
            if (!Array.isArray(versions)) {
                console.error("Invalid versions data received:", versions);
                onVersionsError();
                return;
            }
            try {
                const options = versions.map(v => ({
                    label: `${v.id} ${v.type === 'snapshot' ? '(Snapshot)' : ''}`,
                    value: v.id
                }));
                const releases = versions.filter(v => v.type === 'release').map(v => ({
                    label: v.id,
                    value: v.id
                }));
                // Ensure we have unique values to prevent react key warning
                const uniqueReleases = Array.from(new Map(releases.map(item => [item.value, item])).values());
                const uniqueOptions = Array.from(new Map(options.map(item => [item.value, item])).values());

                setAvailableVersions(uniqueReleases.length > 0 ? uniqueReleases : uniqueOptions);
                setIsLoadingVersions(false);
            } catch (err) {
                console.error("Error processing version list:", err);
                onVersionsError();
            }
        };

        const onVersionsError = () => {
            setIsLoadingVersions(false);
            setAvailableVersions([
                { label: '1.20.4', value: '1.20.4' },
                { label: '1.20.2', value: '1.20.2' },
                { label: '1.20.1', value: '1.20.1' },
                { label: '1.19.4', value: '1.19.4' },
                { label: '1.16.5', value: '1.16.5' },
                { label: '1.12.2', value: '1.12.2' },
                { label: '1.8.9', value: '1.8.9' }
            ]);
        };

        const onVersionsErrorFallback = () => {
            if (timeoutId) clearTimeout(timeoutId);
            onVersionsError();
        };

        socket.on('versions_list', onVersionsList);
        socket.on('versions_error', onVersionsErrorFallback);

        timeoutId = setTimeout(() => {
            console.warn("Version fetch timed out (15s)");
            onVersionsError();
        }, 15000);

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            socket.off('versions_list', onVersionsList);
            socket.off('versions_error', onVersionsErrorFallback);
        };
    }, [socket]);

    useEffect(() => {
        if (!socket) return;
        const onProgress = (data) => {
            const percent = typeof data === 'object' ? data.percent : data;
            setUpdateProgress(percent);
            setIsUpdating(true);
            if (percent >= 100) {
                setIsUpdating(false);
                setUpdateStatus('success');
                showToast('Server updated successfully!', 'success');
                setTimeout(() => setUpdateStatus(null), 5000);
            }
        };
        socket.on('install_progress', onProgress);
        return () => socket.off('install_progress', onProgress);
    }, [socket]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            showToast('Server name is required', 'error');
            return;
        }
        if (!ram) {
            showToast('RAM allocation is required', 'error');
            return;
        }
        setIsSaving(true);
        try {
            await updateServer({ name, ram, type, version, gofileToken });
            showToast('Settings saved successfully', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to save settings', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateJar = async () => {
        setIsConfirmUpdateOpen(false);
        setIsUpdating(true);
        setUpdateProgress(0);
        setUpdateStatus(null);
        try {
            await updateServer({ name, ram, type, version });
            await installServer(version);
        } catch (error) {
            setIsUpdating(false);
            setUpdateStatus('error');
            showToast('Failed to update server: ' + error.message, 'error');
        }
    };

    const handleRamChange = (e) => {
        const val = parseInt(e.target.value);
        setRam(formatRam(val));
    };

    if (loading) return <div className="text-white flex items-center justify-center h-64">Loading settings...</div>;
    if (!server) return <div className="text-obsidian-muted">Server not found</div>;

    const isOnline = server.status === 'online' || server.status === 'starting';
    const ramValueMB = parseRam(ram);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {isOnline && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center text-yellow-500">
                    <AlertCircle size={20} className="mr-3" />
                    <span>Server is currently <strong>{server.status}</strong>. Changes will apply after a restart.</span>
                </div>
            )}

            <div className="glass-panel rounded-2xl p-8 mb-8 animate-slide-up" style={{ animationDelay: '0ms' }}>
                <div className="flex items-center space-x-3 mb-6">
                    <Settings size={24} className="text-obsidian-accent" />
                    <h2 className="text-xl font-bold text-white">Server Configuration</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Server Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full glass-input px-4 py-3"
                            placeholder="My Minecraft Server"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Server Type</label>
                        <Select
                            options={serverTypes}
                            value={type}
                            onChange={(val) => setType(val)}
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">GoFile API Token (Optional)</label>
                            <a href="https://gofile.io/myprofile" target="_blank" rel="noopener noreferrer" className="text-xs text-obsidian-accent hover:underline flex items-center">
                                Get Token <Square size={10} className="ml-1" />
                            </a>
                        </div>
                        <input
                            type="password"
                            value={gofileToken}
                            onChange={(e) => setGofileToken(e.target.value)}
                            className="w-full glass-input px-4 py-3"
                            placeholder="Enter your GoFile API Token for backups"
                        />
                        <p className="text-xs text-obsidian-muted ml-1 opacity-70">
                            Leave empty to use guest account (tokens heavily rate limited).
                        </p>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">RAM Allocation</label>
                            <span className={`text-sm font-mono font-bold px-3 py-1 rounded-lg bg-obsidian-accent/10 text-obsidian-accent border border-obsidian-accent/20`}>
                                {Math.floor(ramValueMB / 1024)} GB
                            </span>
                        </div>

                        <div className="px-2 py-4 bg-white/5 rounded-xl border border-white/5">
                            <input
                                type="range"
                                min="1024" // 1GB
                                max={Math.max(totalRamMB, 2048)}
                                step="512" // 0.5GB
                                value={ramValueMB}
                                onChange={handleRamChange}
                                className="w-full accent-obsidian-accent h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-obsidian-muted mt-2 font-mono px-1">
                                <span>1 GB</span>
                                <span>{Math.floor(Math.max(totalRamMB, 2048) / 1024)} GB (Max)</span>
                            </div>
                        </div>
                        <p className="text-xs text-obsidian-muted ml-1 opacity-70">
                            Slide to adjust memory allocation for the Java process.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={loading || isSaving}
                        className="glass-button px-8 py-3 rounded-xl flex items-center gap-2 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100"
                    >
                        {isSaving ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="glass-panel rounded-2xl p-8 animate-slide-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-white/5 rounded-lg text-white">
                        <Play size={20} />
                    </div>
                    <h2 className="text-xl font-bold text-white">Version Management</h2>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Resulting Jar File</label>
                            <div className="glass-input px-4 py-3 text-obsidian-muted opacity-80 cursor-not-allowed bg-black/20 flex items-center justify-between">
                                <span>server.jar</span>
                                <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/70">Fixed Name</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-obsidian-muted uppercase tracking-wider ml-1">Game Version</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <SearchableSelect
                                        options={availableVersions}
                                        value={version} // Pass string value
                                        onChange={(newVal) => setVersion(newVal)} // Receives string value
                                        placeholder={isLoadingVersions ? "Loading versions..." : "Select Version"}
                                        disabled={isLoadingVersions || isUpdating}
                                    />
                                </div>
                                <button
                                    onClick={() => setIsConfirmUpdateOpen(true)}
                                    disabled={isUpdating || server.status !== 'offline'}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 rounded-xl font-medium transition-all disabled:opacity-50 hover:border-white/20 flex items-center whitespace-nowrap"
                                >
                                    {isUpdating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div> : <Download size={18} className="mr-2" />}
                                    {isUpdating ? 'Updating...' : 'Update JAR'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {updateProgress > 0 && (
                        <div className="mt-6 p-4 bg-obsidian-accent/5 rounded-xl border border-obsidian-accent/10">
                            <div className="flex justify-between text-sm text-white mb-2 font-medium">
                                <span>Downloading & Installing...</span>
                                <span>{Math.round(updateProgress)}%</span>
                            </div>
                            <div className="h-2 bg-obsidian-bg rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-200 ${updateStatus === 'success' ? 'bg-green-500' : 'bg-obsidian-accent'}`}
                                    style={{ width: `${updateProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isConfirmUpdateOpen}
                onClose={() => setIsConfirmUpdateOpen(false)}
                title={`Update to Minecraft ${version}?`}
                footer={
                    <>
                        <button onClick={() => setIsConfirmUpdateOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleUpdateJar} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center">
                            <Download size={16} className="mr-2" /> Install Update
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    {isOnline && (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-start text-yellow-500">
                            <AlertCircle size={20} className="mr-3 shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <strong className="block mb-1">Server is Online</strong>
                                Updating the JAR while the server is running might corrupt data. We recommend stopping the server first.
                            </div>
                        </div>
                    )}
                    <p>This will download <strong>server.jar</strong> for version <strong>{version}</strong> from Mojang's official servers. Ensure you have a backup if updating an existing world.</p>
                </div>
            </Modal>
        </div >
    );
};

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ServerSettings Crash:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-red-500 bg-obsidian-surface rounded-xl border border-red-500/20">
                    <h2 className="text-xl font-bold mb-4">Something went wrong</h2>
                    <pre className="text-xs bg-black/50 p-4 rounded overflow-auto">
                        {this.state.error && this.state.error.toString()}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

const ServerSettingsWithBoundary = () => (
    <ErrorBoundary>
        <ServerSettings />
    </ErrorBoundary>
);

export default ServerSettingsWithBoundary;
