const User = require('../models/User');

/**
 * Create default admin user from environment variables if no users exist
 */
const createDefaultAdmin = async () => {
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
};

module.exports = createDefaultAdmin;
