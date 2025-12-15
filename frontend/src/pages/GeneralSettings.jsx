import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { User, Lock, Palette } from 'lucide-react';

const GeneralSettings = () => {
    const { user, updateProfile } = useAuth();
    const { showToast } = useToast();

    // Profile State
    const [username, setUsername] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    React.useEffect(() => {
        if (user?.username) setUsername(user.username);
    }, [user]);

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        if (!username.trim()) return showToast('Username cannot be empty', 'error');

        setIsSavingProfile(true);
        const res = await updateProfile({ username });
        setIsSavingProfile(false);

        if (res.success) {
            showToast('Profile updated successfully', 'success');
        } else {
            showToast(res.error, 'error');
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) return showToast('New passwords do not match', 'error');
        if (!currentPassword) return showToast('Current password is required', 'error');

        setIsSavingPassword(true);
        const res = await updateProfile({ currentPassword, newPassword });
        setIsSavingPassword(false);

        if (res.success) {
            showToast('Password updated successfully', 'success');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } else {
            showToast(res.error, 'error');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Profile Settings */}
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <User className="mr-2" /> Profile Settings
                </h2>

                <div className="space-y-6">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="w-20 h-20 bg-obsidian-accent rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">{user?.username}</h3>
                            <p className="text-obsidian-muted capitalize">{user?.role}</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSavingProfile || username === user?.username}
                                className="px-6 py-2.5 bg-obsidian-surface border border-obsidian-border hover:bg-white/5 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {isSavingProfile ? 'Saving...' : 'Update Profile'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Security Settings */}
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <Lock className="mr-2" /> Security
                </h2>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Current Password</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button
                            type="submit"
                            disabled={isSavingPassword || !currentPassword || !newPassword}
                            className="px-6 py-2.5 bg-obsidian-surface border border-obsidian-border hover:bg-white/5 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {isSavingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                    </div>
                </form>
            </div>


        </div>
    );
};

export default GeneralSettings;
