import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RoleGuard = ({ permission, adminOnly }) => {
    const { user, loading } = useAuth();

    console.log('RoleGuard:', { role: user?.role, perm: permission, adminOnly, path: window.location.pathname });

    if (loading) return null; // Or a spinner

    // Admin bypass - always allowed
    if (user?.role === 'admin') {
        return <Outlet />;
    }

    // User role restrictions:
    // If route requires ANY specific permission or is adminOnly, User role is blocked
    // (User role generally has empty permissions array, but explicit check is safer)
    if (user?.role === 'user') {
        // User role can ONLY access public/overview routes (which won't be wrapped in RoleGuard with props)
        // So if this guard is active (props exist), User is denied.
        return <Navigate to="/" replace />;
    }

    // Sub-admin checks
    if (adminOnly) {
        return <Navigate to="/" replace />;
    }

    if (permission) {
        if (user?.permissions?.includes(permission)) {
            return <Outlet />;
        }
    }

    // Fallback denied
    return <Navigate to="/" replace />;
};

export default RoleGuard;
