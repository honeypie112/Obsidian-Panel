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
    renameFile: async (path, oldName, newName) => {
        const res = await fetch(`${BASE_URL}/control/files/rename`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ path: path.join('/'), oldName, newName })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to rename item');
        }
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
    compressFiles: async (path, files) => {
        const res = await fetch(`${BASE_URL}/control/files/compress`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ currentPath: path.join('/'), files })
        });
        if (!res.ok) throw new Error('Failed to compress files');
        return res.json();
    },
    uploadFile: (path, file, onProgress) => {
        // ... (existing implementation)
        return new Promise((resolve, reject) => {
            // ...
        });
    },
    uploadFileChunked: async (path, file, onProgress) => {
        const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const fileName = file.name;
        const startTime = Date.now();
        let uploadedBytes = 0;

        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('file', chunk);
            formData.append('path', path.join('/'));
            formData.append('fileName', fileName);
            formData.append('chunkIndex', i.toString());
            formData.append('totalChunks', totalChunks.toString());

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', `${BASE_URL}/control/files/upload-chunk`);
                xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('obsidian_token')}`);

                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable && onProgress) {
                        // Calculate total progress including this partial chunk
                        const currentChunkLoaded = event.loaded;
                        const totalLoaded = uploadedBytes + currentChunkLoaded;
                        const percentComplete = Math.round((totalLoaded / file.size) * 100);

                        // Calculate speed
                        const now = Date.now();
                        const diffTime = (now - startTime) / 1000;
                        let uploadSpeed = '0 B/s';
                        if (diffTime > 0) {
                            const speedBytes = totalLoaded / diffTime;
                            const k = 1024;
                            const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
                            const iSize = Math.floor(Math.log(speedBytes) / Math.log(k));
                            const safeI = Math.min(Math.max(iSize, 0), sizes.length - 1);
                            uploadSpeed = parseFloat((speedBytes / Math.pow(k, safeI)).toFixed(2)) + ' ' + sizes[safeI];
                        }

                        onProgress(percentComplete, uploadSpeed);
                    }
                };

                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        try {
                            const error = JSON.parse(xhr.responseText);
                            reject(new Error(error.message || 'Chunk upload failed'));
                        } catch (e) {
                            reject(new Error(xhr.statusText || 'Chunk upload failed'));
                        }
                    }
                };
                xhr.onerror = () => reject(new Error('Network error'));
                xhr.send(formData);
            });

            uploadedBytes += chunk.size;
        }
        return { success: true };
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
    installPlugin: async (projectId, source) => {
        const res = await fetch(`${BASE_URL}/plugins/install`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ projectId, source })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Installation failed');
        }
        return res.json();
    },
    // User Management
    getUsers: async () => {
        const res = await fetch(`${BASE_URL}/users`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },
    createUser: async (userData) => {
        const res = await fetch(`${BASE_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(userData)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create user');
        }
        return res.json();
    },
    updateUser: async (id, userData) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(userData)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to update user');
        }
        return res.json();
    },
    deleteUser: async (id) => {
        const res = await fetch(`${BASE_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to delete user');
        return res.json();
    }
};
