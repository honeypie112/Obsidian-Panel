const mongoose = require('mongoose');

const ServerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    port: {
        type: Number,
        required: true,
        unique: true,
    },
    version: {
        type: String,
        default: '1.20.4',
    },
    status: {
        type: String,
        enum: ['online', 'offline', 'starting', 'stopping'],
        default: 'offline',
    },
    directory: {
        type: String,
        required: true,
    },
    memory: {
        type: Number,
        default: 2048, // MB
    },
    cpuUsage: {
        type: Number,
        default: 0,
    },
    ramUsage: {
        type: Number,
        default: 0,
    },
    activePlayers: {
        type: Number,
        default: 0,
    },
    maxPlayers: {
        type: Number,
        default: 20,
    },
    pid: {
        type: Number,
        default: null,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Server', ServerSchema);
