import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
    const [selectedServer, setSelectedServer] = useState(null);
    const { user, logout } = useAuth();

    // Auto-load the single server on mount
    useEffect(() => {
        const loadServer = async () => {
            try {
                const response = await axios.get('/api/servers');
                if (response.data && response.data.length > 0) {
                    setSelectedServer(response.data[0]); // Get the first (and only) server
                }
            } catch (error) {
                console.error('Failed to load server:', error);
            }
        };

        loadServer();
    }, []);

    return (
        <div className="dashboard-container">
            <Sidebar />

            <div className="dashboard-main">
                <div className="dashboard-header">
                    <div className="server-title">
                        <h2>{selectedServer?.name || 'Minecraft Server'}</h2>
                    </div>

                    <div className="header-actions">
                        <div className="user-info">
                            <div className="user-avatar">
                                {user?.username?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <span className="user-name">{user?.username}</span>
                        </div>

                        <button className="logout-button" onClick={logout}>
                            <LogOut size={18} />
                        </button>
                    </div>
                </div>

                <div className="dashboard-content">
                    <Outlet context={{ selectedServer, setSelectedServer }} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
