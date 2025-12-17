import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Terminal, Folder, Settings, Shield, HardDrive, Server, LogOut, Package, User, Github, Coffee } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const Sidebar = ({ isOpen, onClose }) => {
    const { logout, user } = useAuth();

    const allNavItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/', permission: 'overview.view' }, // Default for all usually, but can be explicit
        { icon: Terminal, label: 'Console', path: '/console', permission: 'console.command' }, // Using console.command as gate
        { icon: Folder, label: 'Files', path: '/files', permission: 'files.view' },
        { icon: Package, label: 'Plugin Store', path: '/plugins', permission: 'plugins.manage' },
        { icon: HardDrive, label: 'Backups', path: '/backups', permission: 'backups.view' },
        { icon: Settings, label: 'Server Settings', path: '/server-settings', permission: 'settings.edit' },
        { icon: Shield, label: 'General Settings', path: '/general-settings', permission: 'settings.edit' },
        { icon: User, label: 'Users', path: '/users', adminOnly: true },
    ];

    const navItems = allNavItems.filter(item => {
        if (user?.role === 'admin') return true;

        // Sub-admin or User checks
        if (item.adminOnly) return false;

        // If no specific permission required (and not adminOnly), show it (e.g. Overview default behavior)
        // However, user said "bas server dashboard access kr sake by default", so maybe EVERYTHING else needs perms?
        // Let's assume Overview is always shown for authed users, as it's the landing page.
        // I marked Overview with 'overview.view', but I didn't add 'overview.view' to Users.jsx.
        // Let's treat Overview as public-for-authed.
        if (item.label === 'Overview') return true;

        if (item.permission) {
            return user?.permissions?.includes(item.permission);
        }

        return true;
    });
    const sidebarClasses = clsx(
        'bg-obsidian-surface-glass backdrop-blur-xl border-r border-obsidian-border flex flex-col',
        'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out md:static md:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
    );
    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in"
                    onClick={onClose}
                />
            )}
            <div className={sidebarClasses}>
                <div className="h-16 flex items-center px-6 border-b border-white/5 justify-between">
                    <div className="flex items-center group cursor-pointer">
                        <div className="relative">
                            <Shield className="text-obsidian-accent mr-3 transition-transform group-hover:scale-110 duration-300" size={24} />
                            <div className="absolute inset-0 bg-obsidian-accent blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                        </div>
                        <span className="font-bold text-lg tracking-tight text-white group-hover:text-obsidian-accent transition-colors duration-300">Obsidian</span>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => onClose && window.innerWidth < 768 && onClose()}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden',
                                    isActive
                                        ? 'text-white shadow-[0_0_20px_rgba(139,92,246,0.15)] ring-1 ring-white/10'
                                        : 'text-obsidian-muted hover:text-white hover:bg-white/5'
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-obsidian-accent/20 to-transparent opacity-100 transition-opacity duration-300" />
                                    )}
                                    {isActive && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-obsidian-accent rounded-r-full shadow-[0_0_10px_#8b5cf6]"></div>
                                    )}
                                    <item.icon
                                        size={20}
                                        className={clsx(
                                            "mr-3 z-10 transition-transform duration-300 group-hover:scale-110",
                                            isActive ? "text-obsidian-accent drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]" : "group-hover:text-white"
                                        )}
                                    />
                                    <span className={clsx("font-medium text-sm z-10", isActive && "font-semibold")}>{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>
                <div className="p-4 border-t border-white/5">
                    <div className="mb-4 grid grid-cols-2 gap-2">
                        <a
                            href="https://github.com/honeypie112/Obsidian-Panel"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all text-xs border border-white/5 hover:border-white/20"
                            title="Project Source"
                        >
                            <Github size={14} className="mr-1.5" /> Source
                        </a>
                        <a
                            href="https://buymeacoffee.com/alex5402"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center p-2 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500/70 hover:text-yellow-400 transition-all text-xs border border-yellow-500/10 hover:border-yellow-500/30"
                            title="Buy Me a Coffee"
                        >
                            <Coffee size={14} className="mr-1.5" /> Donate
                        </a>
                    </div>
                    <button
                        onClick={logout}
                        className="flex items-center w-full px-4 py-3 text-obsidian-muted hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300 group border border-transparent hover:border-red-500/20"
                    >
                        <LogOut size={20} className="mr-3 transition-transform group-hover:-translate-x-1" />
                        <span className="font-medium text-sm">Logout</span>
                    </button>
                    <div className="mt-4 flex items-center justify-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-[10px] uppercase tracking-wider text-obsidian-muted font-mono">System Online</span>
                    </div>
                </div>
            </div>
        </>
    );
};
export default Sidebar;
