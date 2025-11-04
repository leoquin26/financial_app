const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Notification = require('../models/Notification');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = new User({
            username,
            email,
            password: hashedPassword
        });

        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName || user.username,
                currency: user.currency || 'PEN'
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        // Find user
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'your-secret-key-change-this-in-production',
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                fullName: user.fullName || user.username,
                currency: user.currency || 'PEN'
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName || user.username,
            currency: user.currency || 'PEN'
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user information' });
    }
});

// Get user settings
router.get('/settings', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Return user settings with default values
        res.json({
            username: user.username,
            email: user.email,
            fullName: user.fullName || '',
            phone: user.phone || '',
            currency: user.currency || 'PEN',
            language: user.language || 'es',
            timezone: user.timezone || 'America/Lima',
            dateFormat: user.dateFormat || 'DD/MM/YYYY',
            theme: user.theme || 'light',
            notifications: {
                email: user.notifications?.email ?? true,
                push: user.notifications?.push ?? true,
                budgetAlerts: user.notifications?.budgetAlerts ?? true,
                transactionAlerts: user.notifications?.transactionAlerts ?? true,
                weeklyReport: user.notifications?.weeklyReport ?? false,
                monthlyReport: user.notifications?.monthlyReport ?? true,
            },
            privacy: {
                profileVisible: user.privacy?.profileVisible ?? true,
                showEmail: user.privacy?.showEmail ?? false,
                showStats: user.privacy?.showStats ?? true,
            }
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const {
            username,
            email,
            fullName,
            phone,
            currency,
            language,
            timezone,
            dateFormat,
            theme
        } = req.body;
        
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if username or email already exists (if changed)
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({ error: 'Username already exists' });
            }
            user.username = username;
        }
        
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({ error: 'Email already exists' });
            }
            user.email = email;
        }
        
        // Update other fields
        if (fullName !== undefined) user.fullName = fullName;
        if (phone !== undefined) user.phone = phone;
        if (currency !== undefined) user.currency = currency;
        if (language !== undefined) user.language = language;
        if (timezone !== undefined) user.timezone = timezone;
        if (dateFormat !== undefined) user.dateFormat = dateFormat;
        if (theme !== undefined) user.theme = theme;
        
        await user.save();
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Update password
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password required' });
        }
        
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        
        if (!isValidPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        
        await user.save();
        
        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});

// Update notification preferences
router.put('/notifications', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.notifications = {
            ...user.notifications,
            ...req.body
        };
        
        await user.save();
        
        res.json({ message: 'Notification preferences updated' });
    } catch (error) {
        console.error('Update notifications error:', error);
        res.status(500).json({ error: 'Failed to update notifications' });
    }
});

// Update privacy settings
router.put('/privacy', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.privacy = {
            ...user.privacy,
            ...req.body
        };
        
        await user.save();
        
        res.json({ message: 'Privacy settings updated' });
    } catch (error) {
        console.error('Update privacy error:', error);
        res.status(500).json({ error: 'Failed to update privacy' });
    }
});

// Export user data
router.get('/export', authMiddleware, async (req, res) => {
    try {
        const { format = 'json' } = req.query;
        
        // Fetch all user data
        const [user, transactions, budgets, categories] = await Promise.all([
            User.findById(req.userId).select('-password'),
            Transaction.find({ userId: req.userId }).populate('categoryId'),
            Budget.find({ userId: req.userId }).populate('categoryId'),
            Category.find({ $or: [{ userId: req.userId }, { userId: null }] })
        ]);
        
        const data = {
            user: {
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                createdAt: user.createdAt
            },
            transactions,
            budgets,
            categories
        };
        
        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="financial_data_${Date.now()}.json"`);
            res.json(data);
        } else if (format === 'csv') {
            // Convert to CSV format
            const csv = convertToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="financial_data_${Date.now()}.csv"`);
            res.send(csv);
        } else {
            res.status(400).json({ error: 'Invalid format' });
        }
    } catch (error) {
        console.error('Export data error:', error);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Delete account
router.delete('/account', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Delete all user data
        await Promise.all([
            Transaction.deleteMany({ userId }),
            Budget.deleteMany({ userId }),
            Category.deleteMany({ userId }),
            Notification.deleteMany({ userId }),
            User.findByIdAndDelete(userId)
        ]);
        
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Helper function to convert data to CSV
function convertToCSV(data) {
    const transactions = data.transactions.map(t => ({
        Date: t.date,
        Type: t.type,
        Amount: t.amount,
        Category: t.categoryId?.name || '',
        Description: t.description || ''
    }));
    
    if (transactions.length === 0) {
        return 'Date,Type,Amount,Category,Description\n';
    }
    
    const headers = Object.keys(transactions[0]).join(',');
    const rows = transactions.map(t => Object.values(t).join(','));
    
    return [headers, ...rows].join('\n');
}

module.exports = router;