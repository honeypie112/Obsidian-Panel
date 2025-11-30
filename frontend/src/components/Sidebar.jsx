import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Terminal,
    Users,
    FolderOpen,
    Settings,
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = () => {
    const location = useLocation();

    const menuItems = [
        { path: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
        { path: '/dashboard/console', icon: Terminal, label: 'Console' },
        { path: '/dashboard/players', icon: Users, label: 'Players' },
        { path: '/dashboard/files', icon: FolderOpen, label: 'File Manager' },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="logo-icon">O</div>
                <span className="logo-text">Obsidian Panel</span>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section">
                    {menuItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </div>
            </nav>

            <Link to="/dashboard/settings" className="sidebar-footer">
                <Settings size={20} />
                <span>Settings</span>
            </Link>
        </div>
    );
};

export default Sidebar;
