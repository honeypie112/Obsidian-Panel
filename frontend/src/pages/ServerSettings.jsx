import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { Save, Download, CheckCircle, AlertCircle } from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';
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
const ServerSettings = () => {
    const { server, updateServer, loading, installServer, socket } = useServer();
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [ram, setRam] = useState('');
    const [type, setType] = useState('vanilla');
    const [version, setVersion] = useState('');
    const [availableVersions, setAvailableVersions] = useState([]);
    const [isLoadingVersions, setIsLoadingVersions] = useState(false);
    const [ramOptions, setRamOptions] = useState([1, 2, 4, 8, 16]);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateStatus, setUpdateStatus] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmUpdateOpen, setIsConfirmUpdateOpen] = useState(false);
    useEffect(() => {
        if (server) {
            setName(server.name || '');
            setRam(server.ram || '');
            setType(server.type || 'vanilla');
            if (server.version) setVersion(server.version);
            if (server.totalMem) {
                setRamOptions(generateRamOptions(server.totalMem));
            }
        }
    }, [server?.name, server?.ram, server?.version, server?.totalMem, server?.type]);
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
                setAvailableVersions(options);
                setIsLoadingVersions(false);
            } catch (err) {
                console.error("Error processing version list:", err);
                onVersionsError();
            }
        };
        const onVersionsError = () => {
            setIsLoadingVersions(false);
            showToast('Using offline version list', 'warning');
            setAvailableVersions([
                { label: '1.20.4 (Offline)', value: '1.20.4' },
                { label: '1.20.2', value: '1.20.2' },
                { label: '1.20.1', value: '1.20.1' },
                { label: '1.19.4', value: '1.19.4' },
                { label: '1.19.3', value: '1.19.3' },
                { label: '1.19.2', value: '1.19.2' },
                { label: '1.18.2', value: '1.18.2' },
                { label: '1.18.1', value: '1.18.1' },
                { label: '1.17.1', value: '1.17.1' },
                { label: '1.16.5', value: '1.16.5' },
                { label: '1.16.4', value: '1.16.4' },
                { label: '1.15.2', value: '1.15.2' },
                { label: '1.14.4', value: '1.14.4' },
                { label: '1.13.2', value: '1.13.2' },
                { label: '1.12.2', value: '1.12.2' },
                { label: '1.8.9', value: '1.8.9' },
                { label: '1.8.8', value: '1.8.8' },
                { label: '1.7.10', value: '1.7.10' }
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
            await updateServer({ name, ram, type, version });
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
    if (loading) return <div className="text-white flex items-center justify-center h-64">Loading settings...</div>;
    if (!server) return <div className="text-obsidian-muted">Server not found</div>;
    const isOnline = server.status === 'online' || server.status === 'starting';
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {isOnline && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center text-yellow-500">
                    <AlertCircle size={20} className="mr-3" />
                    <span>Server is currently <strong>{server.status}</strong>. Changes will apply after a restart.</span>
                </div>
            )}
            { }
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <SettingsIcon className="mr-2" /> Server Configuration
                </h2>
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Server Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Server Type</label>
                            <SearchableSelect
                                options={[
                                    { label: 'Vanilla (Official)', value: 'vanilla' },
                                    { label: 'PaperMC (Optimized)', value: 'paper' },
                                    { label: 'Purpur (Advanced)', value: 'purpur' }
                                ]}
                                value={type}
                                onChange={setType}
                                placeholder="Select Server Type..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">RAM Allocation</label>
                            <SearchableSelect
                                options={ramOptions.map(gb => ({ label: `${gb} GB`, value: `${gb}GB` }))}
                                value={ram}
                                onChange={setRam}
                                placeholder="Select or type (e.g. 4GB)..."
                            />
                            <p className="text-xs text-obsidian-muted mt-1">Select from list or type custom value</p>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex items-center px-6 py-2.5 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            <Save size={18} className="mr-2" />
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
            { }
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">Version Management</h2>
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Minecraft Version</label>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <SearchableSelect
                                    options={availableVersions}
                                    value={version}
                                    onChange={setVersion}
                                    placeholder={isLoadingVersions ? "Loading versions..." : "Select Version..."}
                                    disabled={isLoadingVersions || isUpdating}
                                />
                                <p className="text-xs text-obsidian-muted mt-1">Fetched from official Mojang Manifest</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || isUpdating}
                                    className="flex items-center justify-center px-4 py-2.5 bg-obsidian-surface border border-obsidian-border hover:bg-white/5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 h-[42px]"
                                    title="Save version setting without installing"
                                >
                                    <Save size={18} />
                                </button>
                                <button
                                    onClick={() => setIsConfirmUpdateOpen(true)}
                                    disabled={isUpdating}
                                    className="flex items-center justify-center px-6 py-2.5 bg-obsidian-surface border border-obsidian-border hover:bg-white/5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap h-[42px]"
                                >
                                    <Download size={18} className="mr-2" />
                                    {isUpdating ? 'Updating...' : 'Update JAR'}
                                </button>
                            </div>
                        </div>
                    </div>
                    { }
                    {(isUpdating || updateStatus === 'success') && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between text-xs text-obsidian-muted">
                                <span>{updateStatus === 'success' ? 'Update Complete' : `Downloading Minecraft ${version}...`}</span>
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
        </div>
    );
};
const SettingsIcon = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
);
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
