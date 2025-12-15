import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Terminal, FolderOpen, Settings, Server, LogOut, Shield, HardDrive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const Sidebar = ({ isOpen, onClose }) => {
    const { logout } = useAuth();

    const navItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/' },
        { icon: Terminal, label: 'Console', path: '/console' },
        { icon: FolderOpen, label: 'Files', path: '/files' },
        { icon: HardDrive, label: 'Backups', path: '/backups' },
        { icon: Settings, label: 'Server Settings', path: '/server-settings' },
        { icon: Server, label: 'General Settings', path: '/general-settings' },
    ];

    const sidebarClasses = clsx(
        'bg-obsidian-surface border-r border-obsidian-border flex flex-col',
        'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
    );

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in"
                    onClick={onClose}
                />
            )}

            <div className={sidebarClasses}>
                <div className="h-16 flex items-center px-6 border-b border-obsidian-border justify-between">
                    <div className="flex items-center">
                        <Shield className="text-obsidian-accent mr-3" size={24} />
                        <span className="font-bold text-lg tracking-tight text-white">Obsidian</span>
                    </div>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => onClose && window.innerWidth < 768 && onClose()}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center px-4 py-3 rounded-lg transition-all duration-200 group',
                                    isActive
                                        ? 'bg-obsidian-accent/10 text-obsidian-accent border border-obsidian-accent/20'
                                        : 'text-obsidian-muted hover:bg-white/5 hover:text-white'
                                )
                            }
                        >
                            <item.icon size={20} className="mr-3" />
                            <span className="font-medium text-sm">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-obsidian-border">
                    <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-3 text-obsidian-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                        <LogOut size={20} className="mr-3" />
                        <span className="font-medium text-sm">Logout</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
