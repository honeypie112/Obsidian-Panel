import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Server, Trash2, Save } from 'lucide-react';
import axios from 'axios';
import './ServerSettings.css';

const ServerSettings = () => {
    const { selectedServer, setSelectedServer } = useOutletContext();
    const navigate = useNavigate();

    const [settings, setSettings] = useState({
        name: '',
        version: '',
        memory: 2048,
    });

    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (selectedServer) {
            setSettings({
                name: selectedServer.name,
                version: selectedServer.version,
                memory: selectedServer.memory,
            });
        }
    }, [selectedServer]);

    const handleSave = async () => {
        if (!selectedServer) return;

        setLoading(true);
        try {
            const response = await axios.put(
                `/api/servers/${selectedServer._id}/settings`,
                settings,
                {
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                    },
                }
            );

            alert('Settings saved successfully!');
            setSelectedServer(response.data.server);
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedServer) return;

        const confirmText = `DELETE ${selectedServer.name}`;
        const userInput = prompt(
            `⚠️ WARNING: This will permanently delete the server and ALL its files!\n\nType "${confirmText}" to confirm:`
        );

        if (userInput !== confirmText) {
            alert('Deletion cancelled - text did not match');
            return;
        }

        setDeleting(true);
        try {
            await axios.delete(`/api/servers/${selectedServer._id}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            alert('Server deleted successfully');
            setSelectedServer(null);
            navigate('/dashboard');
            window.location.reload(); // Refresh to update server list
        } catch (error) {
            console.error('Failed to delete server:', error);
            alert('Failed to delete server');
            setDeleting(false);
        }
    };

    if (!selectedServer) {
        return (
            <div className="no-server">
                <h2>No Server Selected</h2>
                <p>Please select a server to manage settings</p>
            </div>
        );
    }

    return (
        <div className="server-settings-page">
            <div className="settings-header">
                <h1>Server Settings</h1>
                <p className="page-subtitle">Configure your Minecraft server</p>
            </div>

            <div className="settings-content">
                {/* Basic Settings Card */}
                <div className="settings-card card">
                    <div className="card-header">
                        <Server size={20} />
                        <h2>Basic Settings</h2>
                    </div>

                    <div className="settings-form">
                        <div className="form-group">
                            <label>Server Name</label>
                            <input
                                type="text"
                                value={settings.name}
                                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                                placeholder="My Minecraft Server"
                            />
                        </div>

                        <div className="form-group">
                            <label>Minecraft Version</label>
                            <select
                                value={settings.version}
                                onChange={(e) => setSettings({ ...settings, version: e.target.value })}
                            >
                                <option value="1.21.3">1.21.3 (Latest)</option>
                                <option value="1.21.2">1.21.2</option>
                                <option value="1.21.1">1.21.1</option>
                                <option value="1.21">1.21</option>
                                <option value="1.20.6">1.20.6</option>
                                <option value="1.20.5">1.20.5</option>
                                <option value="1.20.4">1.20.4</option>
                                <option value="1.20.2">1.20.2</option>
                                <option value="1.20.1">1.20.1</option>
                                <option value="1.20">1.20</option>
                                <option value="1.19.4">1.19.4</option>
                            </select>
                            <span className="hint">Note: Changing version requires downloading a new server JAR</span>
                        </div>

                        <div className="form-group">
                            <label>Memory Allocation (MB)</label>
                            <input
                                type="number"
                                value={settings.memory}
                                onChange={(e) => setSettings({ ...settings, memory: parseInt(e.target.value) })}
                                min="512"
                                step="512"
                            />
                            <span className="hint">Recommended: 2048MB (2GB) minimum</span>
                        </div>

                        <button onClick={handleSave} className="save-btn" disabled={loading}>
                            <Save size={16} />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>

                {/* Danger Zone Card */}
                <div className="settings-card card danger-card">
                    <div className="card-header">
                        <Trash2 size={20} />
                        <h2>Danger Zone</h2>
                    </div>

                    <div className="danger-content">
                        <div className="danger-warning">
                            <h3>Delete This Server</h3>
                            <p>Once you delete a server, there is no going back. This will permanently delete:</p>
                            <ul>
                                <li>All server files and worlds</li>
                                <li>All configuration and plugins</li>
                                <li>All player data</li>
                            </ul>
                        </div>

                        <button onClick={handleDelete} className="delete-btn" disabled={deleting}>
                            <Trash2 size={16} />
                            {deleting ? 'Deleting...' : 'Delete Server Permanently'}
                        </button>
                    </div>
                </div>

                {/* Server Info */}
                <div className="settings-card card info-card">
                    <h3>Server Information</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <span className="info-label">Server ID</span>
                            <span className="info-value">{selectedServer._id}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Port</span>
                            <span className="info-value">{selectedServer.port}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Directory</span>
                            <span className="info-value">{selectedServer.directory}</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">Status</span>
                            <span className={`status-badge ${selectedServer.status}`}>
                                {selectedServer.status}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerSettings;
