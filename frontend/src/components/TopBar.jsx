import React from 'react';
import { useServer } from '../context/ServerContext';
import { useAuth } from '../context/AuthContext';
import { User, Server as ServerIcon, Menu } from 'lucide-react';

const TopBar = ({ onMenuClick }) => {
    const { server, updateServer } = useServer();
    const { user } = useAuth();

    return (
        <div className="h-16 bg-obsidian-surface/50 backdrop-blur-md border-b border-obsidian-border flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
            {/* Mobile Menu Button */}
            <button
                onClick={onMenuClick}
                className="md:hidden mr-4 text-obsidian-muted hover:text-white transition-colors"
                aria-label="Open Menu"
            >
                <Menu size={24} />
            </button>
            {/* Server Status Indicator */}
            <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-white/5 border border-obsidian-border">
                <div className={`w-2 h-2 rounded-full ${server?.status === 'online' ? 'bg-green-500' :
                    server?.status === 'starting' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                <span className="text-sm font-medium text-white">
                    {server?.name || 'Server'}
                </span>
                {server && (
                    <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${server.status === 'online' ? 'bg-green-500/20 text-green-400' :
                        server.status === 'starting' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                        {server.status}
                    </span>
                )}
            </div>

            {/* User Profile */}
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-white">{user?.name}</p>
                        <p className="text-xs text-obsidian-muted capitalize">{user?.role}</p>
                    </div>
                    <div className="w-9 h-9 bg-obsidian-accent rounded-full flex items-center justify-center text-white font-bold shadow-lg shadow-obsidian-accent/20">
                        {user?.name?.charAt(0) || <User size={18} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TopBar;
