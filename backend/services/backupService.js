const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const crypto = require('crypto');
const Backup = require('../models/Backup');
const Settings = require('../models/Settings');
const minecraftService = require('./minecraftService');

let scheduledTask = null;
let isBackupInProgress = false;

// Default Config
const DEFAULT_CONFIG = {
    enabled: false,
    frequency: 'daily', // daily, weekly, custom
    cronExpression: '0 0 * * *', // Daily at midnight by default
    maxBackups: 10 // Optional: auto-delete old
};

const BackupService = {
    // --- State Getter ---
    isBackupInProgress: () => isBackupInProgress,

    // --- Core Backup Logic ---
    performBackup: async (manualTrigger = false) => {
        if (isBackupInProgress) {
            throw new Error('Backup already in progress');
        }

        // Check token
        const token = process.env.GOFILE_API_TOKEN || process.env.YOUR_API_TOKEN;
        if (!token) {
            throw new Error('GoFile API Token not found in .env');
        }

        const serverDir = minecraftService.serverDir;
        if (!fs.existsSync(serverDir)) {
            throw new Error('Server directory not found');
        }

        isBackupInProgress = true;

        // Define Paths
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `backup-${timestamp}${manualTrigger ? '-manual' : '-auto'}.zip`;
        const tempDir = process.env.TEMP_BACKUP_PATH || path.resolve(__dirname, '../../tmp');

        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempZipPath = path.resolve(tempDir, backupName);

        try {
            // Generate Password
            const encryptionPassword = crypto.randomBytes(6).toString('hex');

            // Zip
            console.log(`[BackupService] Starting backup: ${backupName}`);
            const zipCmd = `zip -r -q -P "${encryptionPassword}" "${tempZipPath}" .`;

            await new Promise((resolve, reject) => {
                exec(zipCmd, { cwd: serverDir }, (error, stdout, stderr) => {
                    if (error) reject(new Error(`Zip failed: ${stderr || error.message}`));
                    else resolve();
                });
            });

            // Calculate Size
            const stats = fs.statSync(tempZipPath);
            const fileSize = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';

            // Upload
            console.log(`[BackupService] Uploading to GoFile...`);
            const fileBuffer = fs.readFileSync(tempZipPath);
            const fileBlob = new Blob([fileBuffer]);
            const formData = new FormData();
            formData.append('file', fileBlob, backupName);

            const uploadRes = await fetch('https://upload.gofile.io/uploadfile', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            if (!uploadRes.ok) {
                const text = await uploadRes.text();
                throw new Error(`GoFile upload failed: ${uploadRes.status} ${text}`);
            }

            const data = await uploadRes.json();

            if (data.status === 'ok') {
                const newBackup = new Backup({
                    fileName: data.data.fileName || backupName,
                    downloadPage: data.data.downloadPage,
                    guestToken: data.data.guestToken,
                    size: fileSize,
                    encryptionPassword: encryptionPassword
                });
                await newBackup.save();
                console.log(`[BackupService] Backup success: ${newBackup.fileName}`);
                return newBackup;
            } else {
                throw new Error(JSON.stringify(data));
            }

        } catch (err) {
            console.error('[BackupService] Backup error:', err);
            throw err;
        } finally {
            // Cleanup
            if (fs.existsSync(tempZipPath)) {
                try { fs.unlinkSync(tempZipPath); } catch (e) { }
            }
            isBackupInProgress = false;
        }
    },

    // --- Scheduler ---
    initScheduler: async () => {
        console.log('[BackupService] Initializing Scheduler...');
        try {
            let setting = await Settings.findOne({ key: 'backup_config' });
            if (!setting) {
                setting = new Settings({ key: 'backup_config', value: DEFAULT_CONFIG });
                await setting.save();
            }
            BackupService.applySchedule(setting.value);
        } catch (err) {
            console.error('[BackupService] Failed to load settings:', err);
        }
    },

    applySchedule: (config) => {
        // Stop existing
        if (scheduledTask) {
            scheduledTask.stop();
            scheduledTask = null;
        }

        if (!config.enabled) {
            console.log('[BackupService] Auto-backup is disabled.');
            return;
        }

        if (!cron.validate(config.cronExpression)) {
            console.error(`[BackupService] Invalid cron expression: ${config.cronExpression}`);
            return;
        }

        console.log(`[BackupService] Scheduled auto-backup: ${config.cronExpression} (${config.frequency})`);
        scheduledTask = cron.schedule(config.cronExpression, async () => {
            console.log('[BackupService] Triggering auto-backup...');
            try {
                // If server is running or we don't care about state? 
                // Usually safe to backup running server if just zipping files, 
                // though data consistency *might* be slightly off without stop.
                // For now, we do HOT backup.
                await BackupService.performBackup(false);
            } catch (err) {
                console.error('[BackupService] Auto-backup failure:', err.message);
            }
        });
    },

    getSettings: async () => {
        const setting = await Settings.findOne({ key: 'backup_config' });
        return setting ? setting.value : DEFAULT_CONFIG;
    },

    saveSettings: async (newConfig) => {
        const value = { ...DEFAULT_CONFIG, ...newConfig };

        // Validate Cron
        if (value.enabled && !cron.validate(value.cronExpression)) {
            throw new Error('Invalid cron expression');
        }

        await Settings.findOneAndUpdate(
            { key: 'backup_config' },
            { value },
            { upsert: true, new: true }
        );

        BackupService.applySchedule(value);
        return value;
    }
};

module.exports = BackupService;
