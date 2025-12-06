import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockApi } from '../utils/mockApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hasAdmin, setHasAdmin] = useState(false);

    useEffect(() => {
        const initAuth = async () => {
            const adminExists = await mockApi.hasAdmin();
            setHasAdmin(adminExists);

            // No longer simulating token validation from localStorage
            // if (token) {
            //     // Simulate validating token / fetching user profile
            //     setUser({ name: 'Admin User', role: 'admin' });
            // }
            setLoading(false);
        };
        initAuth();
    }, []); // Removed token from dependency array as it's no longer initialized from localStorage

    const register = async (username, password) => {
        try {
            await mockApi.register(username, password);
            setHasAdmin(true);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const checkHasAdmin = async () => {
        return await mockApi.hasAdmin();
    };

    const login = async (username, password) => {
        try {
            const data = await mockApi.login(username, password);
            setToken(data.token);
            setUser(data.user);
            // localStorage.setItem('obsidian_token', data.token); // Removed localStorage call
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        // localStorage.removeItem('obsidian_token'); // Removed localStorage call
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, register, checkHasAdmin, hasAdmin, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
