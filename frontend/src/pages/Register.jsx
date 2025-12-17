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
        <div className="min-h-screen bg-obsidian-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-obsidian-accent/20 rounded-full blur-[100px] animate-pulse-slow"></div>
                <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-[100px] animate-float"></div>
            </div>

            <div className="w-full max-w-md glass-card rounded-2xl p-8 relative z-10 animate-slide-up">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-obsidian-accent border border-white/10 shadow-lg shadow-obsidian-accent/20 backdrop-blur-xl">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight text-center">Initial Setup</h1>
                    <p className="text-obsidian-muted mt-2 text-center">Create admin account to get started</p>
                </div>
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center backdrop-blur-sm animate-fade-in">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-obsidian-muted uppercase tracking-wider ml-1">Username</label>
                        <input
                            type="text"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full glass-input px-4 py-3"
                            placeholder="Choose a username"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-obsidian-muted uppercase tracking-wider ml-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full glass-input px-4 py-3"
                            placeholder="Choose a password"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-obsidian-muted uppercase tracking-wider ml-1">Confirm Password</label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full glass-input px-4 py-3"
                            placeholder="Confirm password"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full glass-button py-3.5 rounded-xl mt-4 text-base tracking-wide flex items-center justify-center gap-2 group"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                Create Admin Account <span className="text-lg leading-none transition-transform group-hover:translate-x-1">→</span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};
export default Register;
