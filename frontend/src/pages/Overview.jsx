import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Play, Square, Wrench, Users, Cpu, HardDrive } from 'lucide-react';
import StatCard from '../components/StatCard';
import axios from 'axios';
import { io } from 'socket.io-client';
import './Overview.css';

const Overview = () => {
    const { selectedServer } = useOutletContext();
    const [serverStatus, setServerStatus] = useState(selectedServer?.status || 'offline');
    const [stats, setStats] = useState({
        cpu: 0,
        ram: 0,
        players: 0,
    });
    const [activities, setActivities] = useState([]);

    useEffect(() => {
        if (!selectedServer) return;
        setServerStatus(selectedServer.status);

        const socketUrl = process.env.NODE_ENV === 'production'
            ? window.location.origin
            : 'http://localhost:3000';

        const socket = io(socketUrl);

        socket.on('connect', () => {
            socket.emit('joinServer', selectedServer._id);
        });

        socket.on('stats', (data) => {
            setStats(data);
        });

        socket.on('serverStatus', (data) => {
            setServerStatus(data.status);
        });

        return () => {
            socket.emit('leaveServer', selectedServer._id);
            socket.disconnect();
        };
    }, [selectedServer?._id]);

    const handleStartServer = async () => {
        try {
            setServerStatus('starting');
            await axios.put(`/api/servers/${selectedServer._id}/start`);
        } catch (error) {
            console.error('Failed to start server:', error);
            setServerStatus('offline');
        }
    };

    const handleStopServer = async () => {
        try {
            setServerStatus('stopping');
            await axios.put(`/api/servers/${selectedServer._id}/stop`);
        } catch (error) {
            console.error('Failed to stop server:', error);
        }
    };

    if (!selectedServer) {
        return (
            <div className="no-server">
                <h2>No Server Selected</h2>
                <p>Please select a server from the dropdown above</p>
            </div>
        );
    }

    const isRunning = serverStatus === 'online' || serverStatus === 'starting';

    return (
        <div className="overview-page">
            <div className="overview-header">
                <div>
                    <h1>{selectedServer.name}</h1>
                    <p className="server-info">
                        Port: {selectedServer.port} | Version: {selectedServer.version || 'Unknown'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link to="/dashboard/server-settings" className="settings-link-btn">
                        <Wrench size={18} />
                        Server Settings
                    </Link>
                    <button
                        className={`server-control-btn ${isRunning ? 'stop' : 'start'}`}
                        onClick={isRunning ? handleStopServer : handleStartServer}
                        disabled={serverStatus === 'starting' || serverStatus === 'stopping'}
                    >
                        {serverStatus === 'starting' ? (
                            'Starting...'
                        ) : serverStatus === 'stopping' ? (
                            'Stopping...'
                        ) : isRunning ? (
                            <>
                                <Square size={18} />
                                Stop Server
                            </>
                        ) : (
                            <>
                                <Play size={18} />
                                Start Server
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="stats-grid">
                <StatCard
                    title="CPU Usage"
                    value={`${stats.cpu.toFixed(1)}%`}
                    subtitle="Intel Xeon E-2236"
                    icon={Cpu}
                    color="blue"
                    progress={stats.cpu}
                />

                <StatCard
                    title="RAM Usage"
                    value={`${stats.ram.toFixed(1)}%`}
                    subtitle={`${(selectedServer.memory * stats.ram / 100 / 1024).toFixed(1)} GB / ${(selectedServer.memory / 1024).toFixed(1)} GB`}
                    icon={HardDrive}
                    color="purple"
                    progress={stats.ram}
                />


            </div>

            <div className="activity-card card">
                <div className="activity-header">
                    <Users size={20} />
                    <h2>Recent Activity</h2>
                </div>

                <div className="activity-list">
                    {activities.length === 0 ? (
                        <div className="no-activity">
                            <p>No recent activity</p>
                        </div>
                    ) : (
                        activities.map((activity, index) => (
                            <div key={index} className="activity-item">
                                <div className="activity-icon">
                                    <Play size={16} />
                                </div>
                                <div className="activity-info">
                                    <div className="activity-title">{activity.title}</div>
                                    <div className="activity-subtitle">{activity.subtitle}</div>
                                </div>
                                <div className="activity-time">{activity.time}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default Overview;
