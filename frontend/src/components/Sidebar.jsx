import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Terminal, Folder, Settings, Shield, HardDrive, Server, LogOut, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
const Sidebar = ({ isOpen, onClose }) => {
    const { logout } = useAuth();
    const navItems = [
        { icon: LayoutDashboard, label: 'Overview', path: '/' },
        { icon: Terminal, label: 'Console', path: '/console' },
        { icon: Folder, label: 'Files', path: '/files' },
        { icon: Package, label: 'Plugin Store', path: '/plugins' },
        { icon: HardDrive, label: 'Backups', path: '/backups' },
        { icon: Settings, label: 'Server Settings', path: '/server-settings' },
        { icon: Shield, label: 'General Settings', path: '/general-settings' },
    ];
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
