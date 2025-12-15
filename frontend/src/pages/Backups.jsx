import React, { useState, useEffect, useRef } from 'react';
import { CloudUpload, HardDrive, Download, CheckCircle, Database, Shield, Trash2, Clock, FileArchive, AlertTriangle, Calendar, X, Lock, Copy, RotateCw, Settings } from 'lucide-react';
import { serverApi } from '../api/server';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import DatePicker from '../components/DatePicker';
import Select from '../components/Select';
const frequencyOptions = [
    { value: 'minute', label: 'Every minute (* * * * *)' },
    { value: 'hourly', label: 'Every hour (0 * * * *)' },
    { value: 'daily', label: 'Every day at midnight (0 0 * * *)' },
    { value: 'weekly_sun', label: 'Every Sunday at midnight (0 0 * * 0)' },
    { value: 'monthly_1st', label: 'Every month on the 1st at midnight (0 0 1 * *)' },
    { value: 'every_15_min', label: 'Every 15 minutes (*/15 * * * *)' },
    { value: 'every_weekday', label: 'Every weekday at midnight (0 0 * * 1-5)' },
    { value: 'custom', label: 'Custom' }
];
const Backups = () => {
    const { showToast } = useToast();
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBackupInProgress, setIsBackupInProgress] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [backupConfig, setBackupConfig] = useState({
        enabled: false,
        frequency: 'daily',
        cronExpression: '0 0 * * *'
    });
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
    const [backupToRestore, setBackupToRestore] = useState(null);
    const [isRestoring, setIsRestoring] = useState(false);
    const [filterDate, setFilterDate] = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [backupData, setBackupData] = useState(null);
    const pollIntervalRef = useRef(null);
    useEffect(() => {
        loadBackups();
        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);
    const checkStatus = async () => {
        try {
            const status = await serverApi.getBackupStatus();
            setIsBackupInProgress(status.isBackupInProgress);
        } catch (e) {
            console.error(e);
        }
    };
    const loadBackups = async () => {
        try {
            const data = await serverApi.getBackups();
            setBackups(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    const loadConfig = async () => {
        try {
            const config = await serverApi.getBackupConfig();
            setBackupConfig(config);
            setIsConfigModalOpen(true);
        } catch (err) {
            showToast('Failed to load settings', 'error');
        }
    };
    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            let cron = backupConfig.cronExpression;
            switch (backupConfig.frequency) {
                case 'minute': cron = '* * * * *'; break;
                case 'hourly': cron = '0 * * * *'; break;
                case 'daily': cron = '0 0 * * *'; break;
                case 'weekly_sun': cron = '0 0 * * 0'; break;
                case 'monthly_1st': cron = '0 0 1 * *'; break;
                case 'every_15_min': cron = '*/15 * * * *'; break;
                case 'every_weekday': cron = '0 0 * * 1-5'; break;
                case 'custom': break;
                default: break;
            }
            const newConfig = { ...backupConfig, cronExpression: cron };
            await serverApi.updateBackupConfig(newConfig);
            setBackupConfig(newConfig);
            showToast('Auto-Backup settings saved', 'success');
            setIsConfigModalOpen(false);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setIsSavingConfig(false);
        }
    };
    const handleCreateBackup = async () => {
        setIsCreating(true);
        try {
            const data = await serverApi.createBackup();
            setBackupData(data);
            showToast('Backup created successfully!', 'success');
            setBackups(prev => [data, ...prev]);
            loadBackups();
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Failed to create backup', 'error');
        } finally {
            setIsCreating(false);
            setIsCreateModalOpen(false);
        }
    };
    const confirmRestore = (backup) => {
        setBackupToRestore(backup);
        setIsRestoreModalOpen(true);
    };
    const handleRestore = async () => {
        if (!backupToRestore) return;
        window.onbeforeunload = () => true;
        setIsRestoring(true);
        try {
            await serverApi.restoreBackup(backupToRestore._id);
            showToast('Server restored successfully!', 'success');
            setIsRestoreModalOpen(false);
            setBackupToRestore(null);
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Failed to restore backup', 'error');
        } finally {
            setIsRestoring(false);
            window.onbeforeunload = null;
        }
    };
    const handleDelete = (id) => {
        setDeleteId(id);
    };



    const handleDeleteBackup = async () => {
        if (!deleteId) return;
        try {
            await serverApi.deleteBackup(deleteId);
            setBackups(prev => prev.filter(b => b._id !== deleteId));
            showToast('Backup deleted', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setDeleteId(null);
        }
    };
    const handleCopyPassword = (password) => {
        navigator.clipboard.writeText(password);
        showToast('Password copied to clipboard', 'success');
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleString();
    };
    const filteredBackups = backups.filter(backup => {
        if (!filterDate) return true;
        const backupDate = new Date(backup.createdAt);
        const [fYear, fMonth, fDay] = filterDate.split('-').map(Number);
        return backupDate.getFullYear() === fYear &&
            backupDate.getMonth() === fMonth - 1 &&
            backupDate.getDate() === fDay;
    });
    const isBusy = loading || isBackupInProgress;
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            { }
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Server Backups
                    </h1>
                    <p className="text-obsidian-muted mt-1">
                        Off-site backups powered by GoFile.io
                    </p>
                </div>
                <button
                    onClick={loadConfig}
                    className="px-4 py-2 bg-obsidian-surface hover:bg-white/5 text-white rounded-xl border border-obsidian-border transition-all flex items-center"
                >
                    <Settings className="mr-2" size={18} />
                    Auto Backup
                </button>
            </div>
            { }
            <Modal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                title="Auto Backup Settings"
                footer={
                    <>
                        <button onClick={() => setIsConfigModalOpen(false)} className="px-4 py-2 text-obsidian-muted hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleSaveConfig} className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg flex items-center" disabled={isSavingConfig}>
                            {isSavingConfig ? 'Saving...' : 'Save Settings'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg border border-obsidian-border">
                        <div>
                            <h3 className="text-white font-medium">Enable Auto Backup</h3>
                            <p className="text-sm text-obsidian-muted">Automatically create backups on a schedule.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={backupConfig.enabled}
                                onChange={(e) => setBackupConfig({ ...backupConfig, enabled: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-obsidian-accent rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-obsidian-accent"></div>
                        </label>
                    </div>
                    <div>
                        <Select
                            label="Schedule"
                            value={backupConfig.frequency}
                            onChange={(val) => setBackupConfig({ ...backupConfig, frequency: val })}
                            options={frequencyOptions}
                            disabled={!backupConfig.enabled}
                        />
                    </div>
                    {backupConfig.frequency === 'custom' && (
                        <div>
                            <label className="block text-sm font-medium text-obsidian-muted mb-2">Cron Expression</label>
                            <input
                                type="text"
                                value={backupConfig.cronExpression}
                                onChange={(e) => setBackupConfig({ ...backupConfig, cronExpression: e.target.value })}
                                placeholder="e.g. 0 0 * * *"
                                className="w-full bg-black/20 border border-obsidian-border text-white rounded-lg p-2.5 focus:border-obsidian-accent focus:outline-none font-mono"
                                disabled={!backupConfig.enabled}
                            />
                            <p className="text-xs text-obsidian-muted mt-1">Format: Minute Hour Day Month DayOfWeek</p>
                        </div>
                    )}
                </div>
            </Modal>
            { }
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-lg shadow-black/20">
                <div className="w-16 h-16 bg-obsidian-accent/10 rounded-full flex items-center justify-center text-obsidian-accent mb-2">
                    <CloudUpload size={32} />
                </div>
                <h2 className="text-xl font-bold text-white">Cloud Backup</h2>
                <p className="text-obsidian-muted max-w-md">
                    Create a full compressed backup of your Minecraft server directory and securely upload it to GoFile.
                </p>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    disabled={isBusy}
                    className="mt-4 px-6 py-3 bg-obsidian-accent hover:bg-obsidian-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all shadow-lg hover:shadow-obsidian-accent/20 flex items-center"
                >
                    {isBusy ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3"></span>
                            {isBackupInProgress ? "Backup in Progress..." : "Creating Backup..."}
                        </>
                    ) : (
                        <>
                            <HardDrive size={20} className="mr-2" />
                            Create New Backup
                        </>
                    )}
                </button>
                {isBackupInProgress && (
                    <p className="text-xs text-yellow-500/80 animate-pulse mt-2">
                        A backup is currently running in the background. Please wait.
                    </p>
                )}
            </div>
            { }
            {backupData && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-6 animate-in slide-in-from-bottom-5">
                    <div className="flex items-start">
                        <CheckCircle className="text-green-500 shrink-0 mt-1 mr-4" size={24} />
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white mb-2">Backup Complete!</h3>
                            <p className="text-obsidian-muted mb-4">
                                Your backup has been successfully uploaded to GoFile.
                            </p>
                            <div className="bg-black/30 rounded-lg p-4 flex items-center justify-between border border-white/5">
                                <span className="font-mono text-sm text-gray-300 truncate mr-4">
                                    {backupData.fileName}
                                </span>
                                <a
                                    href={backupData.downloadPage}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center px-4 py-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                                >
                                    <Download size={16} className="mr-2" />
                                    Download from GoFile
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            { }
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white flex items-center">
                        <Database size={20} className="mr-2 text-obsidian-muted" />
                        Backup History
                    </h3>
                    { }
                    <div className="w-48">
                        <DatePicker
                            value={filterDate}
                            onChange={setFilterDate}
                            placeholder="Filter by date..."
                        />
                    </div>
                </div>
                {filteredBackups.length === 0 ? (
                    <div className="text-center py-10 bg-obsidian-surface border border-obsidian-border rounded-xl text-obsidian-muted flex flex-col items-center">
                        <Database size={40} className="opacity-20 mb-3" />
                        {filterDate ? (
                            <p>No backups found for {filterDate}.</p>
                        ) : (
                            <p>No backups found.</p>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {filteredBackups.map(backup => (
                            <div key={backup._id} className="bg-obsidian-surface border border-obsidian-border p-4 rounded-xl flex items-center justify-between hover:border-obsidian-accent/30 transition-colors group">
                                <div className="flex items-center space-x-4">
                                    <div className="p-3 bg-obsidian-accent/5 rounded-lg text-obsidian-accent">
                                        <FileArchive size={20} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-200 flex items-center">
                                            {backup.fileName}
                                            {backup.encryptionPassword && (
                                                <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 flex items-center uppercase tracking-wider">
                                                    <Lock size={10} className="mr-1" /> Encrypted
                                                </span>
                                            )}
                                        </p>
                                        <div className="flex flex-col space-y-1 mt-1">
                                            <div className="flex items-center space-x-4 text-xs text-obsidian-muted">
                                                <span className="flex items-center">
                                                    <Clock size={12} className="mr-1" />
                                                    {formatDate(backup.createdAt)}
                                                </span>
                                                <span className="px-1.5 py-0.5 bg-white/5 rounded">
                                                    {backup.size}
                                                </span>
                                            </div>
                                            {backup.encryptionPassword && (
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <div className="bg-black/30 rounded px-2 py-1 flex items-center border border-white/5 group-hover:border-white/10 transition-colors">
                                                        <span className="text-xs font-mono text-gray-400 mr-2 select-all">
                                                            {backup.encryptionPassword}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleCopyPassword(backup.encryptionPassword);
                                                            }}
                                                            className="text-gray-500 hover:text-white transition-colors"
                                                            title="Copy Password"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => confirmRestore(backup)}
                                        className="p-2 text-obsidian-muted hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                        title="Restore this backup"
                                        disabled={isBackupInProgress || isRestoring}
                                    >
                                        <RotateCw size={18} />
                                    </button>
                                    <a
                                        href={backup.downloadPage}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 text-obsidian-muted hover:text-obsidian-accent hover:bg-obsidian-accent/10 rounded-lg transition-colors"
                                        title="Download"
                                    >
                                        <Download size={18} />
                                    </a>
                                    <button
                                        onClick={() => handleDelete(backup._id)}
                                        className="p-2 text-obsidian-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Delete"
                                        disabled={isBackupInProgress || isRestoring}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            { }
            <Modal
                isOpen={isRestoreModalOpen}
                onClose={() => !isRestoring && setIsRestoreModalOpen(false)}
                title="Restore Backup"
            >
                <div className="space-y-4">
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start">
                        <AlertTriangle className="text-red-500 shrink-0 mt-0.5 mr-3" size={20} />
                        <div className="text-sm text-red-200">
                            <strong>Warning:</strong> Restoring will <u>STOP</u> the server and <u>DELETE ALL</u> current files in the server directory before extracting this backup.
                            <br /><br />
                            This action cannot be undone. Are you sure you want to proceed?
                            {isRestoring && (
                                <div className="mt-3 p-2 bg-red-500/20 rounded font-bold text-red-100 animate-pulse text-center border border-red-500/40">
                                    RESTORING... DO NOT REFRESH OR CLOSE THIS PAGE
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            onClick={() => setIsRestoreModalOpen(false)}
                            className="px-4 py-2 rounded-lg text-obsidian-muted hover:text-white hover:bg-white/5 transition-colors"
                            disabled={isRestoring}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleRestore}
                            disabled={isRestoring}
                            className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center gap-2"
                        >
                            {isRestoring ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Restoring...
                                </>
                            ) : (
                                <>
                                    <RotateCw size={16} />
                                    Confirm Restore
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>
            { }
            <Modal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Create Cloud Backup"
                footer={
                    <>
                        <button
                            onClick={() => setIsCreateModalOpen(false)}
                            className="px-4 py-2 bg-obsidian-button hover:bg-obsidian-button-hover text-white rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateBackup}
                            className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded-lg transition-colors"
                        >
                            Start Backup
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center text-center">
                    <div className="bg-blue-500/10 p-3 rounded-full text-blue-400 mb-4">
                        <CloudUpload size={32} />
                    </div>
                    <p className="mb-2 text-white font-medium">Ready to start?</p>
                    <p className="text-sm">
                        This will compress your entire server directory and upload it to GoFile.
                        Depending on your server size and internet connection, this may take a few minutes.
                    </p>
                </div>
            </Modal>
            { }
            <Modal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Delete Backup Record"
                footer={
                    <>
                        <button
                            onClick={() => setDeleteId(null)}
                            className="px-4 py-2 bg-obsidian-button hover:bg-obsidian-button-hover text-white rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteBackup}
                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                        >
                            Delete Record
                        </button>
                    </>
                }
            >
                <div className="flex flex-col items-center text-center">
                    <div className="bg-red-500/10 p-3 rounded-full text-red-500 mb-4">
                        <AlertTriangle size={32} />
                    </div>
                    <p className="mb-2 text-white font-medium">Are you sure?</p>
                    <p className="text-sm">
                        This will remove the backup record from your local history.
                        It will <strong>not</strong> delete the file from GoFile automatically.
                    </p>
                </div>
            </Modal>
        </div>
    );
};
export default Backups;
