const User = require('../models/User');
const Server = require('../models/Server');
const path = require('path');

/**
 * Create default admin user from environment variables if no users exist
 */
async function createDefaultAdmin() {
    try {
        const userCount = await User.countDocuments();

        if (userCount === 0) {
            const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME;
            const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;

            if (defaultUsername && defaultPassword) {
                const admin = new User({
                    username: defaultUsername,
                    password: defaultPassword,
                    role: 'admin',
                });

                await admin.save();
                console.log(`✅ Default admin created: ${defaultUsername}`);
            } else {
                console.log('⚠️  No default admin credentials set in .env');
                console.log('   Set DEFAULT_ADMIN_USERNAME and DEFAULT_ADMIN_PASSWORD to auto-create admin');
            }
        }
    } catch (error) {
        console.error('❌ Failed to create default admin:', error.message);
    }
}

/**
 * Create default server instance if no servers exist
 */
async function createDefaultServer() {
    try {
        const serverCount = await Server.countDocuments();
        if (serverCount === 0) {
            const serverBasePath = process.env.MC_SERVER_BASE_PATH || '/app/servers';
            const serverDir = path.join(serverBasePath, 'minecraft-server');

            await Server.create({
                name: 'Minecraft Server',
                javaPort: parseInt(process.env.MC_JAVA_PORT) || 25565,
                bedrockPort: parseInt(process.env.MC_BEDROCK_PORT) || 19132,
                voipPort: parseInt(process.env.VOIP_PORT) || 5060,
                version: '1.20.4',
                status: 'offline',
                directory: serverDir,
                memory: parseInt(process.env.MC_DEFAULT_MEMORY) || 2048,
            });

            console.log('✅ Default Minecraft server created');
            console.log(`   Java Port: ${process.env.MC_JAVA_PORT || 25565}`);
            console.log(`   Bedrock Port: ${process.env.MC_BEDROCK_PORT || 19132}`);
            console.log(`   VoIP Port: ${process.env.VOIP_PORT || 5060}`);
        }
    } catch (error) {
        console.error('❌ Failed to create default server:', error.message);
    }
}

module.exports = { createDefaultAdmin, createDefaultServer };
