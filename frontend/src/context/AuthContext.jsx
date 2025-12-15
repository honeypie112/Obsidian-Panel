import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockApi } from '../utils/mockApi';
import { setAuthToken } from '../api/server';
import { API_URL } from '../config';
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hasAdmin, setHasAdmin] = useState(false);
    useEffect(() => {
        const initAuth = async () => {
            try {
                const res = await fetch(`${API_URL}/api/auth/has-admin`);
                const data = await res.json();
                setHasAdmin(data.hasAdmin);
            } catch (e) {
                console.error(e);
            }
            const storedToken = localStorage.getItem('obsidian_token');
            if (storedToken) {
                setToken(storedToken);
                try {
                    const res = await fetch(`${API_URL}/api/auth/me`, {
                        headers: { 'Authorization': `Bearer ${storedToken}` }
                    });
                    if (res.ok) {
                        const userData = await res.json();
                        setUser(userData);
                    } else {
                        localStorage.removeItem('obsidian_token');
                        setToken(null);
                    }
                } catch (e) {
                    localStorage.removeItem('obsidian_token');
                    setToken(null);
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);
    const register = async (username, password) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Registration failed');
            setHasAdmin(true);
            setToken(data.token);
            setUser(data.user);
            localStorage.setItem('obsidian_token', data.token);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };
    const checkHasAdmin = async () => {
        try {
            const res = await fetch(`${API_URL}/api/auth/has-admin`);
            const data = await res.json();
            return data.hasAdmin;
        } catch { return false; }
    };
    const login = async (username, password) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Login failed');
            setToken(data.token);
            setAuthToken(data.token); // Set token for API calls
            setUser(data.user);
            localStorage.setItem('obsidian_token', data.token);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateProfile = async (data) => {
        try {
            const res = await fetch(`${API_URL}/api/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            let result;
            try {
                result = await res.json();
            } catch (e) {
                const text = await res.text().catch(() => 'Unknown error');
                throw new Error(res.statusText || text || 'Network response was not ok');
            }
            if (!res.ok) throw new Error(result.message || 'Update failed');
            setUser(result);
            return { success: true };
        } catch (error) {
            console.error(error);
            return { success: false, error: error.message };
        }
    };
    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('obsidian_token');
    };
    return (
        <AuthContext.Provider value={{ user, token, login, logout, register, checkHasAdmin, hasAdmin, loading, updateProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
export const useAuth = () => useContext(AuthContext);
