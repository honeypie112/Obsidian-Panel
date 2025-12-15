const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api';

const getHeaders = () => {
    const token = localStorage.getItem('obsidian_token'); // Assuming AuthContext saves this
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const serverApi = {
    getStatus: async () => {
        const res = await fetch(`${API_URL}/control/status`, {
            headers: getHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch status');
        return res.json();
    },

    performAction: async (action) => {
        const res = await fetch(`${API_URL}/control/action`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action })
        });
        if (!res.ok) throw new Error(`Failed to ${action} server`);
        return res.json();
    },

    sendCommand: async (command) => {
        const res = await fetch(`${API_URL}/control/command`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ command })
        });
        if (!res.ok) throw new Error('Failed to send command');
        return res.json();
    },

    install: async (version) => {
        const res = await fetch(`${API_URL}/control/install`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ version })
        });
        if (!res.ok) throw new Error('Failed to start installation');
        return res.json();
    },

    updateServerConfig: async (config) => {
        const res = await fetch(`${API_URL}/control/config`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(config)
        });
        if (!res.ok) throw new Error('Failed to update config');
        return res.json();
    }
};
