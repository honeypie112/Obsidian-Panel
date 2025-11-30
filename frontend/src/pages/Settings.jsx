import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, LogOut, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import './Settings.css';

const Settings = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        // Validation
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (passwordData.newPassword.length < 6) {
            setError('New password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await axios.post('/api/auth/change-password', {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword,
            });

            setSuccess('Password changed successfully!');
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <h1>Settings</h1>
                <p className="page-subtitle">Manage your account and preferences</p>
            </div>

            <div className="settings-grid">
                {/* Account Info Card */}
                <div className="settings-card card">
                    <div className="card-header">
                        <User size={20} />
                        <h2>Account Information</h2>
                    </div>
                    <div className="account-info">
                        <div className="info-row">
                            <span className="info-label">Username</span>
                            <span className="info-value">{user?.username || 'Admin'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Role</span>
                            <span className="badge-role">Administrator</span>
                        </div>
                    </div>
                </div>

                {/* Change Password Card */}
                <div className="settings-card card">
                    <div className="card-header">
                        <Lock size={20} />
                        <h2>Change Password</h2>
                    </div>

                    <form onSubmit={handlePasswordChange} className="password-form">
                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="alert alert-success">
                                <CheckCircle size={16} />
                                {success}
                            </div>
                        )}

                        <div className="form-group">
                            <label>Current Password</label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                placeholder="Enter current password"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>New Password</label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                placeholder="Enter new password (min 6 characters)"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Confirm New Password</label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                placeholder="Confirm new password"
                                required
                            />
                        </div>

                        <button type="submit" className="change-password-btn" disabled={loading}>
                            {loading ? 'Changing...' : 'Change Password'}
                        </button>
                    </form>
                </div>

                {/* Danger Zone Card */}
                <div className="settings-card card danger-card">
                    <div className="card-header">
                        <LogOut size={20} />
                        <h2>Danger Zone</h2>
                    </div>
                    <div className="danger-content">
                        <p>Log out from your account</p>
                        <button onClick={handleLogout} className="logout-btn">
                            <LogOut size={16} />
                            Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
