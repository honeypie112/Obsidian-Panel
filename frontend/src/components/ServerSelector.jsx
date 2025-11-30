import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus } from 'lucide-react';
import CreateServerModal from './CreateServerModal';
import './ServerSelector.css';

const ServerSelector = ({ selectedServer, onServerChange }) => {
    const [servers, setServers] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        fetchServers();
    }, []);

    const fetchServers = async () => {
        try {
            const response = await axios.get('/api/servers');
            setServers(response.data);

            if (response.data.length > 0 && !selectedServer) {
                onServerChange(response.data[0]);
            }
        } catch (error) {
            console.error('Failed to fetch servers:', error);
        }
    };

    const handleServerCreated = (newServer) => {
        setServers([newServer, ...servers]);
        onServerChange(newServer);
        setShowCreateModal(false);
    };

    // Listen for server status updates
    useEffect(() => {
        const socketUrl = process.env.NODE_ENV === 'production'
            ? window.location.origin
            : 'http://localhost:3000';

        // We use a separate socket for the selector to ensure it's always listening
        // In a larger app, this should be in a global context
        import('socket.io-client').then(({ io }) => {
            const socket = io(socketUrl);

            socket.on('connect', () => {
                // Join all server rooms to get updates
                servers.forEach(server => {
                    socket.emit('joinServer', server._id);
                });
            });

            socket.on('serverStatus', (data) => {
                if (data.serverId) {
                    setServers(prevServers =>
                        prevServers.map(server =>
                            server._id === data.serverId
                                ? { ...server, status: data.status }
                                : server
                        )
                    );
                }
            });

            // Clean up
            return () => socket.disconnect();
        });
    }, [servers.length]); // Re-run if server list changes (e.g. new server created)

    const currentServer = servers.find(s => s._id === selectedServer?._id) || selectedServer;

    return (
        <div className="server-selector">
            <button
                className="server-selector-button"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="server-info">
                    <div className="server-status-indicator">
                        <span className={`status-dot status-${currentServer?.status || 'offline'}`} />
                        <span className="status-text">
                            {currentServer?.status?.toUpperCase() || 'NO SERVER'}
                        </span>
                    </div>
                    <div className="server-name">
                        {currentServer?.name || 'Select a server'}
                    </div>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className="dropdown-overlay" onClick={() => setIsOpen(false)} />
                    <div className="server-dropdown">
                        {servers.map((server) => (
                            <button
                                key={server._id}
                                className={`server-option ${server._id === currentServer?._id ? 'active' : ''}`}
                                onClick={() => {
                                    onServerChange(server);
                                    setIsOpen(false);
                                }}
                            >
                                <span className={`status-dot status-${server.status}`} />
                                <div className="server-option-info">
                                    <div className="server-option-name">{server.name}</div>
                                    <div className="server-option-port">Port: {server.port}</div>
                                </div>
                            </button>
                        ))}

                        <button
                            className="server-option create-new"
                            onClick={() => {
                                setIsOpen(false);
                                setShowCreateModal(true);
                            }}
                        >
                            <Plus size={18} />
                            <div className="server-option-info">
                                <div className="server-option-name">Create New Server</div>
                            </div>
                        </button>
                    </div>
                </>
            )}

            <CreateServerModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onServerCreated={handleServerCreated}
            />
        </div>
    );
};

export default ServerSelector;
