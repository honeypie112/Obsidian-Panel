const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth, checkPermission } = require('../middleware');
const bcrypt = require('bcryptjs');

// GET /api/users - List all users
router.get('/', auth, checkPermission('users.view'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// POST /api/users - Create a new user/sub-admin
router.post('/', auth, checkPermission('users.manage'), async (req, res) => {
    const { username, password, role, permissions } = req.body;
    try {
        // Enforce Create restrictions: Sub-Admins shouldn't create Admins?
        // Rust checked: Only Admin can create.
        // Here we allow users.manage permission holder.

        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        user = new User({
            username,
            password,
            role: role || 'user',
            permissions: role === 'sub-admin' ? permissions : []
        });

        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// PUT /api/users/:id - Update user (permissions/role)
router.put('/:id', auth, checkPermission('users.manage'), async (req, res) => {
    const { role, permissions, password } = req.body;
    try {
        let user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Prevent modifying self role if it removes admin access (basic safety)
        if (user.id === req.user.id && role !== 'admin') {
            return res.status(400).json({ message: 'Cannot demote yourself.' });
        }

        if (role) user.role = role;

        // Update permissions only if provided
        if (permissions) {
            user.permissions = permissions;
        }

        if (password) {
            user.password = password; // Pre-save hook will hash it
        }

        await user.save();
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// DELETE /api/users/:id - Delete user
router.delete('/:id', auth, checkPermission('users.manage'), async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        await User.deleteOne({ _id: req.params.id });
        res.json({ message: 'User removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
