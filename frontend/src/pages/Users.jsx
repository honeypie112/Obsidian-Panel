import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, Plus, Trash2, Edit, Save, X, User as UserIcon, Check, Key } from 'lucide-react';
import clsx from 'clsx';
import { serverApi } from '../api/server';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

// ... (PERMISSIONS array not repeated here if possible, but I must match target)
// Actually I can just target the top block.

const PERMISSIONS = [
    { id: 'overview.control', label: 'Control Power (Start/Stop)' },
    { id: 'console.command', label: 'Execute Commands' },
    { id: 'files.view', label: 'View/Download Files' },
    { id: 'files.edit', label: 'Edit Files' },
    { id: 'files.upload', label: 'Upload/Create Files' },
    { id: 'files.delete', label: 'Delete Files' },
    { id: 'backups.view', label: 'View Backups' },
    { id: 'backups.create', label: 'Create Backups' },
    { id: 'backups.restore', label: 'Restore Backups' },
    { id: 'backups.delete', label: 'Delete Backups' },
    { id: 'backups.settings', label: 'Manage Backup Settings' },
    { id: 'plugins.manage', label: 'Manage Plugins' },
    { id: 'settings.edit', label: 'Edit Server Settings' },
];

const Users = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    const fetchUsers = async () => {
        try {
            const data = await serverApi.getUsers();
            setUsers(data);
        } catch (err) {
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const resetForm = () => {
        setUsername('');
        setPassword('');
        setRole('user');
        setSelectedPermissions([]);
        setEditingUser(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (user) => {
        setUsername(user.username);
        setPassword(''); // Don't show existing hash
        setRole(user.role);
        setSelectedPermissions(user.permissions || []);
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handlePermissionToggle = (permId) => {
        setSelectedPermissions(prev =>
            prev.includes(permId)
                ? prev.filter(p => p !== permId)
                : [...prev, permId]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                username,
                role,
                permissions: role === 'sub-admin' ? selectedPermissions : [],
            };
            if (password) payload.password = password;

            if (editingUser) {
                await serverApi.updateUser(editingUser._id, payload);
                toast.success('User updated successfully');
            } else {
                if (!password) return toast.error('Password is required for new users');
                await serverApi.createUser(payload);
                toast.success('User created successfully');
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (err) {
            toast.error(err.message || 'Operation failed');
        }
    };

    const handleDelete = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await serverApi.deleteUser(userId);
            toast.success('User deleted');
            fetchUsers();
        } catch (err) {
            toast.error('Failed to delete user');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Shield className="text-obsidian-accent" size={32} />
                        User Management
                    </h1>
                    <p className="text-obsidian-muted mt-1">Manage admins, sub-admins, and permissions.</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="glass-button bg-obsidian-accent text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-obsidian-accent-hover transition-colors"
                >
                    <Plus size={18} />
                    Create User
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map((user) => (
                    <div key={user._id} className="glass-panel p-6 rounded-xl relative group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className={clsx(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                                    user.role === 'admin' ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                                        user.role === 'sub-admin' ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" :
                                            "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                )}>
                                    <UserIcon size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{user.username}</h3>
                                    <span className={clsx(
                                        "text-xs uppercase px-2 py-0.5 rounded border",
                                        user.role === 'admin' ? "text-red-400 border-red-500/20 bg-red-500/10" :
                                            user.role === 'sub-admin' ? "text-purple-400 border-purple-500/20 bg-purple-500/10" :
                                                "text-blue-400 border-blue-500/20 bg-blue-500/10"
                                    )}>
                                        {user.role}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenEdit(user)}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-obsidian-muted hover:text-white transition-colors"
                                    title="Edit User"
                                >
                                    <Edit size={16} />
                                </button>
                                {currentUser?._id !== user._id && (
                                    <button
                                        onClick={() => handleDelete(user._id)}
                                        className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-obsidian-muted hover:text-red-400 transition-colors"
                                        title="Delete User"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {user.role === 'sub-admin' && (
                            <div className="mt-4 border-t border-white/5 pt-4">
                                <p className="text-xs text-obsidian-muted mb-2 uppercase font-bold tracking-wider">Permissions</p>
                                <div className="flex flex-wrap gap-2">
                                    {(user.permissions || []).slice(0, 5).map(perm => (
                                        <span key={perm} className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-300">
                                            {perm}
                                        </span>
                                    ))}
                                    {(user.permissions?.length || 0) > 5 && (
                                        <span className="text-[10px] bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-gray-400">
                                            +{user.permissions.length - 5} more
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? "Edit User" : "Create User"}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-obsidian-muted text-sm font-medium mb-2">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="glass-input w-full"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-obsidian-muted text-sm font-medium mb-2">
                            {editingUser ? "New Password (Optional)" : "Password"}
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="glass-input w-full"
                            placeholder={editingUser ? "Leave blank to keep current" : ""}
                        />
                    </div>
                    <div>
                        <label className="block text-obsidian-muted text-sm font-medium mb-2">Role</label>
                        <div className="flex gap-4">
                            {['user', 'sub-admin', 'admin'].map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setRole(r)}
                                    className={clsx(
                                        "flex-1 py-2 rounded-lg border text-sm font-semibold transition-all",
                                        role === r
                                            ? "bg-obsidian-accent/20 border-obsidian-accent text-white"
                                            : "bg-white/5 border-white/10 text-obsidian-muted hover:bg-white/10"
                                    )}
                                >
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {role === 'sub-admin' && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                            <label className="block text-obsidian-muted text-sm font-medium mb-3">Permissions</label>
                            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {PERMISSIONS.map((perm) => (
                                    <label
                                        key={perm.id}
                                        className={clsx(
                                            "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                                            selectedPermissions.includes(perm.id)
                                                ? "bg-green-500/10 border-green-500/30"
                                                : "bg-white/5 border-white/5 hover:border-white/20"
                                        )}
                                    >
                                        <div className={clsx(
                                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                            selectedPermissions.includes(perm.id)
                                                ? "bg-green-500 border-green-500"
                                                : "border-gray-500"
                                        )}>
                                            {selectedPermissions.includes(perm.id) && <Check size={14} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={selectedPermissions.includes(perm.id)}
                                            onChange={() => handlePermissionToggle(perm.id)}
                                        />
                                        <span className={clsx(
                                            "text-sm font-medium",
                                            selectedPermissions.includes(perm.id) ? "text-green-400" : "text-gray-400"
                                        )}>
                                            {perm.label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 rounded-lg text-obsidian-muted hover:text-white hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-obsidian-accent hover:bg-obsidian-accent-hover text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2 shadow-lg hover:shadow-obsidian-accent/25 transition-all"
                        >
                            <Save size={18} />
                            Save User
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Users;
