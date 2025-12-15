const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST api/auth/register
// @desc    Register a user
// @access  Public (for now, or restricted if admin exists)
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        let user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Check if any user exists to determine role
        const count = await User.countDocuments();
        const role = count === 0 ? 'admin' : 'user';

        user = new User({
            username,
            password,
            role
        });

        await user.save();

        const payload = {
            id: user.id,
            role: user.role
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        let user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Credentials' });
        }

        const payload = {
            id: user.id,
            role: user.role
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '5d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/auth/profile
// @desc    Update user profile (username & password)
// @access  Private
router.put('/profile', auth, async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Update Username
        if (username && username !== user.username) {
            const exists = await User.findOne({ username });
            if (exists) return res.status(400).json({ message: 'Username already taken' });
            user.username = username;
        }

        // Update Password
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new password' });
            }
            const isMatch = await user.comparePassword(currentPassword);
            if (!isMatch) {
                return res.status(400).json({ message: 'Invalid current password' });
            }
            user.password = newPassword; // Pre-save hook will hash this
        }

        await user.save();

        res.json({
            id: user.id,
            username: user.username,
            role: user.role
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/auth/has-admin
// @desc    Check if any admin exists
// @access  Public
router.get('/has-admin', async (req, res) => {
    try {
        const count = await User.countDocuments({ role: 'admin' });
        res.json({ hasAdmin: count > 0 });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
