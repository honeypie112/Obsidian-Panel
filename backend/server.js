const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config({ path: '../.env' });
require('dotenv').config();  
const authRoutes = require('./routes/auth');
const controlRoutes = require('./routes/control');
const minecraftService = require('./services/minecraftService');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
minecraftService.setSocketIo(io);
app.use(cors());
app.use(express.json());
if (!process.env.MONGO_URI) {
    console.error('FATAL ERROR: MONGO_URI is not defined.');
    console.error('Please check your .env file or environment variables.');
    process.exit(1);
}
mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME
})
    .then(async () => {
        console.log('MongoDB Connected');
        await minecraftService.initDatabase();
        require('./services/backupService').initScheduler();
    })
    .catch(err => console.log(err));
app.use('/api/auth', authRoutes);
app.use('/api/control', controlRoutes);
app.use('/api/backups', require('./routes/backups'));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'public/index.html');
    if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Frontend build not found in backend/public. If running in dev, use the React dev server.');
    }
});
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.emit('status', minecraftService.getStatus());
    socket.emit('log_history', minecraftService.getLogHistory());
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
    socket.on('get_versions', async () => {
        try {
            const versions = await minecraftService.getAvailableVersions();
            socket.emit('versions_list', versions);
        } catch (error) {
            console.error('Failed to fetch versions:', error);
            socket.emit('versions_error', 'Failed to fetch versions');
        }
    });
    socket.on('request_log_history', () => {
        socket.emit('log_history', minecraftService.getLogHistory());
    });
});
app.set('io', io);
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
