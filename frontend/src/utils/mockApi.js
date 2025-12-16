const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const INITIAL_SERVER = {
    id: 'srv-main',
    name: 'Main Server',
    status: 'offline',
    port: 25565,
    ram: '4GB',
    version: '1.20.4',
    cpuUsage: 0,
    ramUsage: 0,
    ramUsage: 0,
    storageUsed: '2.4GB',
    storageTotal: '15GB',
};
const INITIAL_FILES = {
    name: 'root',
    type: 'folder',
    children: [
        { name: 'server.properties', type: 'file', size: '1KB' },
        { name: 'eula.txt', type: 'file', size: '12B' },
        { name: 'ops.json', type: 'file', size: '2B' },
        {
            name: 'world',
            type: 'folder',
            children: [
                { name: 'level.dat', type: 'file', size: '2KB' },
                { name: 'region', type: 'folder', children: [] },
            ]
        },
        {
            name: 'logs',
            type: 'folder',
            children: [
                { name: 'latest.log', type: 'file', size: '14KB' },
            ]
        }
    ]
};
let storedUser = null;
let storedServer = { ...INITIAL_SERVER };
let storedFiles = JSON.parse(JSON.stringify(INITIAL_FILES));  
export const mockApi = {
    login: async (username, password) => {
        await delay(800);
        if (!storedUser) {
            throw new Error('No admin account found. Please register first.');
        }
        if (username === storedUser.username && password === storedUser.password) {
            return { token: 'fake-jwt-token-123', user: { name: storedUser.username, role: 'admin' } };
        }
        throw new Error('Invalid credentials');
    },
    register: async (username, password) => {
        await delay(800);
        if (storedUser) {
            throw new Error('Admin account already exists.');
        }
        storedUser = { username, password };
        return { success: true };
    },
    hasAdmin: async () => {
        await delay(200);
        return !!storedUser;
    },
    getServer: async () => {
        await delay(500);
        return storedServer;
    },
    updateServer: async (updates) => {
        await delay(500);
        storedServer = { ...storedServer, ...updates };
        return storedServer;
    },
    getFiles: async () => {
        await delay(300);
        return storedFiles;
    },
    createFile: async (path, name, type = 'file') => {
        await delay(400);
        let current = storedFiles;
        for (const folder of path) {
            const found = current.children?.find(c => c.name === folder && c.type === 'folder');
            if (found) current = found;
        }
        if (!current.children) current.children = [];
        if (current.children.find(c => c.name === name)) {
            throw new Error('File or folder already exists');
        }
        current.children.push({
            name,
            type,
            size: type === 'folder' ? '-' : '0B',
            children: type === 'folder' ? [] : undefined
        });
        return true;
    },
    deleteFile: async (path, name) => {
        await delay(400);
        let current = storedFiles;
        for (const folder of path) {
            const found = current.children?.find(c => c.name === folder && c.type === 'folder');
            if (found) current = found;
        }
        if (current.children) {
            current.children = current.children.filter(c => c.name !== name);
        }
        return true;
    },
    subscribeToConsole: (callback) => {
        const interval = setInterval(() => {
            const logs = [
                '[Server thread/INFO]: Preparing spawn area: 0%',
                '[Server thread/INFO]: Preparing spawn area: 100%',
                '[Server thread/INFO]: Time elapsed: 1234ms',
                '[Server thread/INFO]: Done (1.234s)! For help, type "help"',
                '[User Authenticator #1/INFO]: UUID of player Steve is 1234-5678',
                '[Server thread/INFO]: Steve joined the game',
            ];
            const randomLog = logs[Math.floor(Math.random() * logs.length)];
            callback(`[${new Date().toLocaleTimeString()}] ${randomLog}`);
        }, 2000);
        return () => clearInterval(interval);
    }
};
