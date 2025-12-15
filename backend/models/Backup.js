const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    size: {
        type: String,
        required: true
    },
    path: {
        type: String,
        required: true
    },
    downloadPage: {
        type: String
    },
    encryptionPassword: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Backup', backupSchema);
