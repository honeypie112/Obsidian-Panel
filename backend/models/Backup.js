const mongoose = require('mongoose');

const BackupSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    downloadPage: {
        type: String,
        required: true
    },
    guestToken: {
        type: String
    },
    size: {
        type: String // We'll store formatted size string for now or bytes
    },
    encryptionPassword: {
        type: String, // Store the generated password
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Backup', BackupSchema);
