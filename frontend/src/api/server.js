import api from '../utils/api';

export const serverApi = {
    getStatus: async () => {
        const res = await api.get('/server/status'); // Need to impl
        return res.data;
    },
    // ...
    getFiles: async (path = []) => {
        const res = await api.get(`/server/files?path=${path.join('/')}`);
        return res.data;
    },
    createFile: async (path, name, type) => {
        const res = await api.post('/server/files/create', { path: path.join('/'), name, type });
        return res.data;
    },
    deleteFile: async (path, name) => {
        const res = await api.delete('/server/files', { data: { path: path.join('/'), name } });
        return res.data;
    },
    // Backups
    getBackups: async () => {
        const res = await api.get('/backups');
        return res.data;
    },
    createBackup: async () => {
        const res = await api.post('/backups/create');
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
        // Mock for now or impl
        return { enabled: false, frequency: 'daily', cronExpression: '0 0 * * *' };
    },
    updateBackupConfig: async (config) => {
        return config;
    }
};
