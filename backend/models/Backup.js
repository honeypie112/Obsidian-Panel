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
    downloadPage: {
        type: String, // GoFile URL
        required: true
    },
    fileId: {
        type: String, // GoFile ID
        required: true
    },
    md5: String,
    encryptionPassword: {
        type: String,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Backup', backupSchema);
