import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Lock, Palette } from 'lucide-react';

const GeneralSettings = () => {
    const { user } = useAuth();

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <User className="mr-2" /> Profile Settings
                </h2>

                <div className="space-y-6">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="w-20 h-20 bg-obsidian-accent rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg">
                            {user?.name?.charAt(0)}
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">{user?.name}</h3>
                            <p className="text-obsidian-muted">{user?.role}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Username</label>
                            <input
                                type="text"
                                defaultValue={user?.name}
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Email</label>
                            <input
                                type="email"
                                defaultValue="admin@obsidian.panel"
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <Lock className="mr-2" /> Security
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Current Password</label>
                        <input
                            type="password"
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">New Password</label>
                            <input
                                type="password"
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase">Confirm Password</label>
                            <input
                                type="password"
                                className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent"
                            />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button className="px-6 py-2.5 bg-obsidian-surface border border-obsidian-border hover:bg-white/5 text-white rounded-lg font-medium transition-colors">
                            Update Password
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-obsidian-surface border border-obsidian-border rounded-xl p-6 opacity-50 pointer-events-none">
                <h2 className="text-xl font-bold text-white mb-6 flex items-center">
                    <Palette className="mr-2" /> Appearance (Coming Soon)
                </h2>
                <p className="text-obsidian-muted">Theme customization will be available in v2.0</p>
            </div>
        </div>
    );
};

export default GeneralSettings;
