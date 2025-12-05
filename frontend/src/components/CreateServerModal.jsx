import React, { useState } from 'react';
import { X } from 'lucide-react';
import axios from 'axios';
import './CreateServerModal.css';

const CreateServerModal = ({ isOpen, onClose, onServerCreated }) => {
    const [formData, setFormData] = useState({
        name: '',
        port: 25565,
        version: '1.20.4',
        memory: 2048,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const popularVersions = [
        '1.20.4',
        '1.20.2',
        '1.20.1',
        '1.19.4',
        '1.19.3',
        '1.18.2',
        '1.17.1',
        '1.16.5',
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post('/api/servers', formData);
            onServerCreated(response.data);
            onClose();

            // Reset form
            setFormData({
                name: '',
                port: 25565,
                version: '1.20.4',
                memory: 2048,
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create server');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Server</h2>
                    <button className="close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="server-form">
                    {error && (
                        <div className="error-banner">
                            {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="name">Server Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="e.g., Survival Server #1"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="port">Port</label>
                            <input
                                type="number"
                                id="port"
                                name="port"
                                value={formData.port}
                                onChange={handleChange}
                                min="1"
                                max="65535"
                                required
                            />
                            <small>Any port (avoid 5000, 5173, 27017)</small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="memory">Memory (MB)</label>
                            <input
                                type="number"
                                id="memory"
                                name="memory"
                                value={formData.memory}
                                onChange={handleChange}
                                min="512"
                                step="512"
                                required
                            />
                            <small>Recommended: 2048+</small>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="version">Minecraft Version</label>
                        <select
                            id="version"
                            name="version"
                            value={formData.version}
                            onChange={handleChange}
                            required
                        >
                            {popularVersions.map((version) => (
                                <option key={version} value={version}>
                                    {version}
                                </option>
                            ))}
                        </select>
                        <small>PurpurMC server JAR will be auto-downloaded</small>
                    </div>

                    <div className="form-actions">
                        <button type="button" className="cancel-btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="create-btn" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Server'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateServerModal;
