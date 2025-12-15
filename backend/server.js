const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
// Try loading from root (dev/local) or current dir (production/docker)
require('dotenv').config({ path: '../.env' });
require('dotenv').config(); // Falls back to standard .env lookup (current dir)

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

// Initialize Service
minecraftService.setSocketIo(io);

// Middleware
app.use(cors());
app.use(express.json());

if (!process.env.MONGO_URI) {
    console.error('FATAL ERROR: MONGO_URI is not defined.');
    console.error('Please check your .env file or environment variables.');
    process.exit(1);
}

// Database Connection
mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME
})
    .then(async () => {
        console.log('MongoDB Connected');
        await minecraftService.initDatabase();
    })
    .catch(err => console.log(err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/control', controlRoutes);

// Serve static files from the React frontend app
app.use(express.static(path.join(__dirname, 'public')));

// Anything that doesn't match the above routes, send back index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Socket.io
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Send initial status on connection
    socket.emit('status', minecraftService.getStatus());

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
});

// Export io to be used in other files
app.set('io', io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
