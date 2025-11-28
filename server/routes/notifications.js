const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { getIo } = require('../utils/socketManager');
const { sendEmail } = require('../utils/emailService');
const { 
    createNotification: scheduleCreateNotification,
    triggerPaymentReminders,
    triggerOverdueCheck,
    triggerBudgetAlerts,
    triggerWeeklyReport
} = require('../services/notificationScheduler');

const router = express.Router();

// Helper to emit real-time notification
const emitNotification = (userId, notification) => {
    const io = getIo();
    if (io) {
        // Emit to both room naming conventions for compatibility
        io.to(`user_${userId}`).emit('new-notification', notification);
        io.to(`user-${userId}`).emit('new-notification', notification);
    }
};

// Helper to get currency symbol
const getCurrencySymbol = (currency) => {
    return currency === 'USD' ? '$' : 'S/';
};

// Helper to get app URL
const getAppUrl = () => {
    return process.env.CLIENT_URL || 'http://localhost:3000';
};

// Legacy create notification function (for backward compatibility)
async function createNotification(userId, type, title, message, data = {}) {
    try {
        const notification = new Notification({
            userId,
            type,
            title,
            message,
            data
        });

        await notification.save();

        // Emit socket event for real-time notification
        emitNotification(userId, notification);

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

// Enhanced create notification with email support
async function createNotificationWithEmail(userId, type, title, message, options = {}) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found for notification:', userId);
            return null;
        }

        const notification = new Notification({
            userId,
            type,
            title,
            message,
            data: options.data || {},
            priority: options.priority || 'normal',
            actionUrl: options.actionUrl,
            relatedEntity: options.relatedEntity
        });

        await notification.save();

        // Emit real-time notification
        emitNotification(userId, notification);

        // Send email if configured
        if (user.notifications?.email && options.emailTemplate && options.emailData) {
            try {
                const result = await sendEmail(user.email, options.emailTemplate, {
                    ...options.emailData,
                    userName: user.fullName || user.username,
                    currency: getCurrencySymbol(user.currency),
                    appUrl: getAppUrl()
                });

                notification.emailSent = result.success;
                notification.emailSentAt = result.success ? new Date() : undefined;
                notification.emailError = result.error;
                await notification.save();
            } catch (emailError) {
                console.error('Error sending notification email:', emailError);
                notification.emailError = emailError.message;
                await notification.save();
            }
        }

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

// Get all notifications for a user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 50, isRead } = req.query;
        
        const query = { userId: req.userId };
        if (isRead !== undefined) {
            query.isRead = isRead === 'true';
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const notifications = await Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notification.countDocuments(query);

        res.json({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// Get unread count
router.get('/unread-count', authMiddleware, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.userId,
            isRead: false
        });

        res.json({ count });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to fetch unread count' });
    }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            {
                _id: req.params.id,
                userId: req.userId
            },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification marked as read', notification });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// Mark all notifications as read
router.put('/read-all', authMiddleware, async (req, res) => {
    try {
        const result = await Notification.updateMany(
            {
                userId: req.userId,
                isRead: false
            },
            { isRead: true }
        );

        res.json({ 
            message: 'All notifications marked as read',
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});

// Delete notification
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// Clear all notifications for a user
router.delete('/', authMiddleware, async (req, res) => {
    try {
        const result = await Notification.deleteMany({
            userId: req.userId
        });

        res.json({ 
            message: 'All notifications cleared',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('Clear all notifications error:', error);
        res.status(500).json({ error: 'Failed to clear all notifications' });
    }
});

// Get notification preferences
router.get('/preferences', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            notifications: user.notifications || {
                email: true,
                push: true,
                budgetAlerts: true,
                transactionAlerts: true,
                weeklyReport: false,
                monthlyReport: true
            }
        });
    } catch (error) {
        console.error('Get notification preferences error:', error);
        res.status(500).json({ error: 'Failed to get notification preferences' });
    }
});

// Update notification preferences
router.put('/preferences', authMiddleware, async (req, res) => {
    try {
        const { notifications } = req.body;
        
        const user = await User.findByIdAndUpdate(
            req.userId,
            { notifications },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Notification preferences updated',
            notifications: user.notifications
        });
    } catch (error) {
        console.error('Update notification preferences error:', error);
        res.status(500).json({ error: 'Failed to update notification preferences' });
    }
});

// Test email notification (for development/testing)
router.post('/test-email', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { template = 'paymentReminder' } = req.body;

        // Test data for different templates
        const testData = {
            paymentReminder: {
                paymentName: 'Test Payment',
                amount: 150.00,
                dueDate: '15/12/2025',
                daysText: 'en 3 días',
                categoryName: 'Servicios',
                notes: 'This is a test notification'
            },
            budgetAlert: {
                categoryName: 'Alimentación',
                spent: 450.00,
                budget: 500.00,
                percentage: 90
            },
            transactionAlert: {
                type: 'expense',
                amount: 75.50,
                description: 'Compra de supermercado',
                categoryName: 'Alimentación',
                date: '28/11/2025'
            }
        };

        const result = await sendEmail(user.email, template, {
            ...testData[template],
            userName: user.fullName || user.username,
            currency: getCurrencySymbol(user.currency),
            appUrl: getAppUrl()
        });

        if (result.success) {
            res.json({ 
                message: 'Test email sent successfully',
                messageId: result.messageId
            });
        } else {
            res.status(500).json({ 
                error: 'Failed to send test email',
                details: result.error
            });
        }
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

// Manual trigger for scheduled notifications (admin/testing)
router.post('/trigger/:type', authMiddleware, async (req, res) => {
    try {
        const { type } = req.params;
        
        switch (type) {
            case 'payment-reminders':
                await triggerPaymentReminders();
                res.json({ message: 'Payment reminders triggered' });
                break;
            case 'overdue-check':
                await triggerOverdueCheck();
                res.json({ message: 'Overdue payment check triggered' });
                break;
            case 'budget-alerts':
                await triggerBudgetAlerts();
                res.json({ message: 'Budget alerts triggered' });
                break;
            case 'weekly-report':
                await triggerWeeklyReport(req.userId);
                res.json({ message: 'Weekly report triggered' });
                break;
            default:
                res.status(400).json({ error: 'Invalid trigger type' });
        }
    } catch (error) {
        console.error('Trigger notification error:', error);
        res.status(500).json({ error: 'Failed to trigger notification' });
    }
});

// Create a custom notification (for manual/admin use)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { type, title, message, data, priority, actionUrl, sendEmail: shouldSendEmail } = req.body;

        if (!type || !title || !message) {
            return res.status(400).json({ error: 'Type, title, and message are required' });
        }

        const notification = await createNotificationWithEmail(
            req.userId,
            type,
            title,
            message,
            {
                data,
                priority,
                actionUrl,
                sendEmail: shouldSendEmail
            }
        );

        if (!notification) {
            return res.status(500).json({ error: 'Failed to create notification' });
        }

        res.status(201).json(notification);
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

module.exports = { router, createNotification, createNotificationWithEmail };