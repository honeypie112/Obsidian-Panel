import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';
const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, checkHasAdmin, user, loading } = useAuth();
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
        <div className="min-h-screen bg-obsidian-bg flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-obsidian-accent/20 rounded-full blur-[100px] animate-pulse-slow"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] animate-float"></div>
            </div>

            <div className="w-full max-w-md glass-card rounded-2xl p-8 relative z-10 animate-slide-up">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6 text-obsidian-accent border border-white/10 shadow-lg shadow-obsidian-accent/20 backdrop-blur-xl">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-white tracking-tight text-center">Obsidian Panel</h1>
                    <p className="text-obsidian-muted mt-2 text-center">Sign in to manage your server</p>
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
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full glass-input px-4 py-3"
                            placeholder="Enter username"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-obsidian-muted uppercase tracking-wider ml-1">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full glass-input px-4 py-3"
                            placeholder="Enter password"
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
                                Sign In <span className="text-lg leading-none transition-transform group-hover:translate-x-1">→</span>
                            </>
                        )}
                    </button>
                </form>
                <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <p className="text-xs text-obsidian-muted font-mono opacity-50">SECURE SYSTEM ACCESS</p>
                </div>
            </div>
        </div>
    );
};
export default Login;
