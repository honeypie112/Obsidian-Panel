const mongoose = require('mongoose');
const ServerConfigSchema = new mongoose.Schema({
    name: { type: String, default: 'main-server' },
    ram: { type: String, default: '4GB' },
    port: { type: Number, default: 25565 },
    version: { type: String, default: '1.20.4' },
    type: { type: String, enum: ['vanilla', 'paper', 'purpur'], default: 'vanilla' },
    gofileToken: { type: String, default: '' }
}, { collection: 'server_config' });
module.exports = mongoose.model('ServerConfig', ServerConfigSchema);
