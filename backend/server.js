require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const createDefaultAdmin = require('./config/createDefaultAdmin');
const ServerManager = require('./services/ServerManager');

// Import routes
const authRoutes = require('./routes/auth');
const serverRoutes = require('./routes/servers');
const fileRoutes = require('./routes/files');
const aiRoutes = require('./routes/ai');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? false
            : 'http://localhost:5173',
        methods: ['GET', 'POST'],
    },
});

// Connect to MongoDB and create default admin
(async () => {
    await connectDB();
    await createDefaultAdmin();
})();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize ServerManager
const serverManager = new ServerManager(io);
app.set('serverManager', serverManager);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('joinServer', (serverId) => {
        socket.join(serverId);
        console.log(`Client ${socket.id} joined server room: ${serverId}`);
    });

    socket.on('leaveServer', (serverId) => {
        socket.leave(serverId);
        console.log(`Client ${socket.id} left server room: ${serverId}`);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ai', aiRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    });
}

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down gracefully...');
    serverManager.cleanup();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════╗
║   🎮 Minecraft Server Panel Started    ║
╠══════════════════════════════════════════╣
║   Port: ${PORT}                            ║
║   Mode: ${process.env.NODE_ENV || 'development'}
║   URL:  http://localhost:${PORT}         ║
╚══════════════════════════════════════════╝
  `);
});
