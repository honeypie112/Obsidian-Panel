import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockApi } from '../utils/mockApi';

const ServerContext = createContext(null);

export const ServerProvider = ({ children }) => {
    const [server, setServer] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchServer = async () => {
        setLoading(true);
        try {
            const data = await mockApi.getServer();
            setServer(data);
        } catch (error) {
            console.error("Failed to fetch server", error);
        } finally {
            setLoading(false);
        }
    };

    const updateServer = async (updates) => {
        const updated = await mockApi.updateServer(updates);
        setServer(updated);
        return updated;
    };

    useEffect(() => {
        fetchServer();
    }, []);

    return (
        <ServerContext.Provider value={{ server, loading, updateServer, fetchServer }}>
            {children}
        </ServerContext.Provider>
    );
};

export const useServer = () => useContext(ServerContext);
