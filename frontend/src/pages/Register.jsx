import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, UserPlus } from 'lucide-react';
const Register = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { register, checkHasAdmin } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        const checkStatus = async () => {
            const hasAdmin = await checkHasAdmin();
            if (hasAdmin) {
                navigate('/login');
            }
        };
        checkStatus();
    }, [checkHasAdmin, navigate]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        setIsLoading(true);
        const result = await register(username, password);
        if (result.success) {
            navigate('/login');
        } else {
            setError(result.error);
        }
        setIsLoading(false);
    };
    return (
        <div className="min-h-screen bg-obsidian-bg flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-obsidian-surface border border-obsidian-border rounded-xl p-8 shadow-2xl relative overflow-hidden">
                { }
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-2 bg-obsidian-accent blur-[50px] opacity-50"></div>
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 bg-obsidian-accent/10 rounded-full flex items-center justify-center mb-4 text-obsidian-accent border border-obsidian-accent/20">
                        <UserPlus size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Setup Admin Account</h1>
                    <p className="text-obsidian-muted text-sm">Create the owner account for this panel</p>
                </div>
                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm text-center">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase tracking-wider">Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent focus:ring-1 focus:ring-obsidian-accent transition-all"
                            placeholder="Choose a username"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase tracking-wider">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent focus:ring-1 focus:ring-obsidian-accent transition-all"
                            placeholder="Choose a password"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase tracking-wider">Confirm Password</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent focus:ring-1 focus:ring-obsidian-accent transition-all"
                            placeholder="Confirm password"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-obsidian-accent hover:bg-obsidian-accent-hover text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {isLoading ? 'Creating Account...' : 'Create Admin Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};
export default Register;
