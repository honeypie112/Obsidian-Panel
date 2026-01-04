const User = require('../models/User');

/**
 * Middleware to check if user has the required permission.
 * Admins always have all permissions.
 * @param {string} requiredPermission - The permission string to check (e.g., 'files.view')
 */
const checkPermission = (requiredPermission) => {
    return async (req, res, next) => {
        try {
            // User should be attached by 'auth' middleware beforehand
            if (!req.user) {
                return res.status(401).json({ message: 'Unauthorized' });
            }

            // Fetch full user to get permissions (auth middleware might only have basic info)
            const user = await User.findById(req.user.id);
            if (!user) {
                return res.status(401).json({ message: 'User not found' });
            }

            // Admin bypass
            if (user.role === 'admin') {
                req.user.permissions = ['*']; // For frontend convenience if passed back
                return next();
            }

            // Check specific permission
            // 'sub-admin' must have the exact permission
            if (user.permissions && user.permissions.includes(requiredPermission)) {
                return next();
            }

            return res.status(403).json({ message: `Access denied. Requires '${requiredPermission}' permission.` });

        } catch (err) {
            console.error('Permission check error:', err);
            res.status(500).json({ message: 'Server error during permission check' });
        }
    };
};

module.exports = checkPermission;
