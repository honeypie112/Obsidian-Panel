import axios from 'axios';
import { API_URL as BASE_URL } from '../config';

const API_URL = `${BASE_URL}/api`;

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// In-memory token storage
let authToken = null;

export const setAuthToken = (token) => {
    authToken = token;
};

// Add auth token to requests
api.interceptors.request.use(
    (config) => {
        if (authToken) {
            config.headers.Authorization = `Bearer ${authToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export const serverApi = {
    getBackups: async () => {
        const res = await api.get('/backups');
        return res.data;
    },
    createBackup: async () => {
        const res = await api.post('/backups');
        return res.data;
    },
    restoreBackup: async (id) => {
        const res = await api.post(`/backups/${id}/restore`);
        return res.data;
    },
    deleteBackup: async (id) => {
        const res = await api.delete(`/backups/${id}`);
        return res.data;
    },
    getBackupStatus: async () => {
        const res = await api.get('/backups/status');
        return res.data;
    },
    getBackupConfig: async () => {
        const res = await api.get('/backups/config');
        return res.data;
    },
    updateBackupConfig: async (config) => {
        const res = await api.put('/backups/config', config);
        return res.data;
    }
};
