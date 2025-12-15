import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';
const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, hasAdmin, checkHasAdmin, user, loading } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        if (!loading && user) {
            navigate('/');
        }
    }, [user, loading, navigate]);
    useEffect(() => {
        const verifyAdmin = async () => {
            const adminExists = await checkHasAdmin();
            if (!adminExists) {
                navigate('/register');
            }
        };
        verifyAdmin();
    }, [checkHasAdmin, navigate]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const result = await login(username, password);
        if (result.success) {
            navigate('/');
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
                        <ShieldCheck size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Obsidian Panel</h1>
                    <p className="text-obsidian-muted text-sm">Sign in to manage your servers</p>
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
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent focus:ring-1 focus:ring-obsidian-accent transition-all"
                            placeholder="Enter username"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-obsidian-muted mb-1 uppercase tracking-wider">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-obsidian-bg border border-obsidian-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-obsidian-accent focus:ring-1 focus:ring-obsidian-accent transition-all"
                            placeholder="Enter password"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-obsidian-accent hover:bg-obsidian-accent-hover text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
                <div className="mt-6 text-center text-xs text-obsidian-muted">
                    <p>Protected System</p>
                </div>
            </div>
        </div>
    );
};
export default Login;
