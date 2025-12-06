import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
    const { token, loading, hasAdmin } = useAuth();

    if (loading) return <div className="min-h-screen bg-obsidian-bg text-white flex items-center justify-center">Loading...</div>;

    if (!hasAdmin) {
        return <Navigate to="/register" />;
    }

    return token ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;
