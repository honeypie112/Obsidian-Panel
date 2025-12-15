import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { serverApi } from '../api/server';
import { SOCKET_URL } from '../config';
const ServerContext = createContext(null);
export const ServerProvider = ({ children }) => {
    const [server, setServer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const fetchServer = async () => {
        try {
            const data = await serverApi.getStatus();
            setServer(data);
        } catch (error) {
            console.error("Failed to fetch server status", error);
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });
        setSocket(newSocket);
        newSocket.on('status', (status) => {
            setServer(status);
            setLoading(false);
        });
        return () => newSocket.close();
    }, []);
    const updateServer = async (updates) => {
        await serverApi.updateServerConfig(updates);
        fetchServer();
    };
    const performAction = async (action) => {
        return await serverApi.performAction(action);
    };
    const installServer = async (version) => {
        return await serverApi.install(version);
    };
    return (
        <ServerContext.Provider value={{
            server,
            loading,
            updateServer,
            fetchServer,
            performAction,
            installServer,
            socket
        }}>
            {children}
        </ServerContext.Provider>
    );
};
export const useServer = () => useContext(ServerContext);
