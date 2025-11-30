import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import ServerSelector from '../components/ServerSelector';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
    const [selectedServer, setSelectedServer] = useState(null);
    const { user, logout } = useAuth();

    return (
        <div className="dashboard-container">
            <Sidebar />

            <div className="dashboard-main">
                <div className="dashboard-header">
                    <ServerSelector
                        selectedServer={selectedServer}
                        onServerChange={setSelectedServer}
                    />

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
                    <Outlet context={{ selectedServer }} />
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
