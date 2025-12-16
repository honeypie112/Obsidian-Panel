import { API_URL } from '../config';
const BASE_URL = `${API_URL}/api`;
const getHeaders = () => {
    const token = localStorage.getItem('obsidian_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};
export const serverApi = {
    getStatus: async () => {
        const res = await fetch(`${BASE_URL}/control/status`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch status');
        return res.json();
    },
    performAction: async (action) => {
        const res = await fetch(`${BASE_URL}/control/action`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action })
        });
        if (!res.ok) throw new Error(`Failed to ${action} server`);
        return res.json();
    },
    sendCommand: async (command) => {
        const res = await fetch(`${BASE_URL}/control/command`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ command })
        });
        if (!res.ok) throw new Error('Failed to send command');
        return res.json();
    },
    install: async (version) => {
        const res = await fetch(`${BASE_URL}/control/install`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ version })
        });
        if (!res.ok) throw new Error('Failed to start installation');
        return res.json();
    },
    updateServerConfig: async (config) => {
        const res = await fetch(`${BASE_URL}/control/config`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error('Failed to update config');
        return res.json();
    },
    getFiles: async (path = []) => {
        const res = await fetch(`${BASE_URL}/control/files/list`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: path.join('/') })
        });
        if (!res.ok) throw new Error('Failed to list files');
        return res.json();
    },
    readFile: async (path) => {
        const res = await fetch(`${BASE_URL}/control/files/read`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: path.join('/') })
        });
        if (!res.ok) throw new Error('Failed to read file');
        return res.json();
    },
    saveFile: async (path, content) => {
        const res = await fetch(`${BASE_URL}/control/files/save`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: path.join('/'), content })
        });
        if (!res.ok) throw new Error('Failed to save file');
        return res.json();
    },
    createFile: async (path, name, type) => {
        const res = await fetch(`${BASE_URL}/control/files/create`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: path.join('/'), name, type })
        });
        if (!res.ok) throw new Error('Failed to create item');
        return res.json();
    },
    deleteFile: async (path, name) => {
        const fullPath = [...path, name].join('/');
        const res = await fetch(`${BASE_URL}/control/files/delete`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: fullPath })
        });
        if (!res.ok) throw new Error('Failed to delete item');
        return res.json();
    },
    extractFile: async (path, name) => {
        const fullPath = [...path, name].join('/');
        const res = await fetch(`${BASE_URL}/control/files/extract`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: fullPath })
        });
        if (!res.ok) throw new Error('Failed to extract file');
        return res.json();
    },
    uploadFile: async (path, file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('path', path.join('/'));
        const res = await fetch(`${BASE_URL}/control/files/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('obsidian_token')}`
            },
            body: formData
        });
        if (!res.ok) throw new Error('Failed to upload file');
        return res.json();
    },
    downloadFile: async (path, name) => {
        const fullPath = [...path, name].join('/');
        const res = await fetch(`${BASE_URL}/control/files/download`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: fullPath })
        });
        if (!res.ok) throw new Error('Failed to download file');
        return res.blob();
    },
    createBackup: async () => {
        const res = await fetch(`${BASE_URL}/backups/create`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Backup failed');
        }
        return res.json();
    },
    getBackupStatus: async () => {
        const res = await fetch(`${BASE_URL}/backups/status`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch backup status');
        return res.json();
    },
    getBackups: async () => {
        const res = await fetch(`${BASE_URL}/backups`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch backups');
        return res.json();
    },
    deleteBackup: async (id) => {
        const res = await fetch(`${BASE_URL}/backups/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete backup');
        return res.json();
    },
    restoreBackup: async (id) => {
        const res = await fetch(`${BASE_URL}/backups/${id}/restore`, {
            method: 'POST',
            headers: getHeaders()
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Restore failed');
        }
        return res.json();
    },
    getBackupConfig: async () => {
        const res = await fetch(`${BASE_URL}/backups/config`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch backup config');
        return res.json();
    },
    updateBackupConfig: async (config) => {
        const res = await fetch(`${BASE_URL}/backups/config`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error('Failed to update config');
        return res.json();
    },
    searchPlugins: async (query) => {
        const res = await fetch(`${BASE_URL}/plugins/search?query=${encodeURIComponent(query)}`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to search plugins');
        return res.json();
    },
    installPlugin: async (projectId) => {
        const res = await fetch(`${BASE_URL}/plugins/install`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ projectId })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Installation failed');
        }
        return res.json();
    }
};
