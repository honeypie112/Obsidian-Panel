import React, { useState, useEffect } from 'react';
import { useServer } from '../context/ServerContext';
import { Save, Download, CheckCircle, AlertCircle } from 'lucide-react';

const ServerSettings = () => {
    const { server, updateServer, loading } = useServer();
    const [name, setName] = useState('');
    const [ram, setRam] = useState('');
    const [version, setVersion] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [updateProgress, setUpdateProgress] = useState(0);
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateStatus, setUpdateStatus] = useState(null); // 'success' | 'error'

    useEffect(() => {
        if (server) {
            setName(server.name);
            setRam(server.ram);
            setVersion(server.version);
        }
    }, [server]);

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        // Simulate save delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateServer({ name, ram, version });
        setIsSaving(false);
    };

    const handleUpdateJar = () => {
        if (isUpdating) return;
        setIsUpdating(true);
        setUpdateProgress(0);
        setUpdateStatus(null);

        const interval = setInterval(() => {
            setUpdateProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setIsUpdating(false);
                    setUpdateStatus('success');
                    setTimeout(() => setUpdateStatus(null), 3000);
                    return 100;
                }
                return prev + Math.random() * 10;
            });
        }, 200);
    };

    if (loading) return <div className="text-white flex items-center justify-center h-64">Loading settings...</div>;
    if (!server) return <div className="text-obsidian-muted">Server not found</div>;

    const isOnline = server.status === 'online' || server.status === 'starting';

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {isOnline && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center text-yellow-500">
                    <AlertCircle size={20} className="mr-3" />
                    <span>Server is currently <strong>{server.status}</strong>. Changes will apply after a restart.</span>
                </div>
            )}

            {/* General Configuration */}
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
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">RAM Allocation</label>
                            <select
                                value={ram}
                                onChange={(e) => setRam(e.target.value)}
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            >
                                <option value="1GB">1 GB</option>
                                <option value="2GB">2 GB</option>
                                <option value="4GB">4 GB</option>
                                <option value="8GB">8 GB</option>
                                <option value="16GB">16 GB</option>
                            </select>
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

            {/* Version Management */}
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">Version Management</h2>

                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Minecraft Version</label>
                        <div className="flex space-x-4">
                            <select
                                value={version}
                                onChange={(e) => setVersion(e.target.value)}
                                className="flex-1 bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            >
                                <option value="1.20.4">1.20.4 (Latest)</option>
                                <option value="1.20.1">1.20.1</option>
                                <option value="1.19.4">1.19.4</option>
                                <option value="1.8.9">1.8.9</option>
                            </select>

                            <button
                                onClick={handleUpdateJar}
                                disabled={isUpdating}
                                className="flex items-center px-6 py-2.5 bg-obsidian-surface border border-obsidian-border hover:bg-white/5 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                                <Download size={18} className="mr-2" />
                                {isUpdating ? 'Updating...' : 'Update JAR'}
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {(isUpdating || updateStatus) && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between text-xs text-obsidian-muted">
                                <span>{updateStatus === 'success' ? 'Update Complete' : 'Downloading server.jar...'}</span>
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

                    {updateStatus === 'success' && (
                        <div className="flex items-center text-green-400 text-sm bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                            <CheckCircle size={16} className="mr-2" />
                            Server JAR updated successfully. Please restart the server to apply changes.
                        </div>
                    )}
                </div>
            </div>
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

export default ServerSettings;
