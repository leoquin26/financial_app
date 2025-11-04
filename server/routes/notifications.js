const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Notification = require('../models/Notification');
const { getIo } = require('../utils/socketManager');

const router = express.Router();

// Helper to create a notification
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
        const io = getIo();
        if (io) {
            io.to(`user_${userId}`).emit('new-notification', notification);
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

module.exports = { router, createNotification };