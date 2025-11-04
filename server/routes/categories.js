const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Get all categories (default + user's)
router.get('/', authMiddleware, async (req, res) => {
    try {
        const categories = await Category.find({
            $or: [
                { userId: null },  // Default categories
                { userId: req.userId }  // User's categories
            ]
        }).sort({ type: 1, name: 1 });

        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Create category
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name, type, color, icon } = req.body;

        // Validate input
        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }

        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Invalid category type' });
        }

        // Check if category already exists for this user
        const existingCategory = await Category.findOne({
            name,
            type,
            userId: req.userId
        });

        if (existingCategory) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        // Create category
        const category = new Category({
            name,
            type,
            color: color || '#808080',
            icon: icon || '📁',
            userId: req.userId
        });

        await category.save();
        res.status(201).json(category);
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Update category
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { name, type, color, icon } = req.body;

        // Find category
        const category = await Category.findOne({
            _id: req.params.id,
            $or: [
                { userId: req.userId },
                { userId: null }  // Allow updating default categories
            ]
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Only allow users to update their own categories
        if (category.userId && category.userId.toString() !== req.userId) {
            return res.status(403).json({ error: 'Not authorized to update this category' });
        }

        // Update fields
        if (name !== undefined) category.name = name;
        if (type !== undefined) category.type = type;
        if (color !== undefined) category.color = color;
        if (icon !== undefined) category.icon = icon;

        await category.save();
        res.json(category);
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});

// Delete category
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // Find category
        const category = await Category.findOne({
            _id: req.params.id,
            $or: [
                { userId: req.userId },
                { userId: null }  // Allow deleting default categories
            ]
        });

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Check if category has transactions
        const transactionCount = await Transaction.countDocuments({
            categoryId: req.params.id,
            userId: req.userId
        });

        if (transactionCount > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with existing transactions',
                transactionCount
            });
        }

        // Delete category
        await Category.deleteOne({ _id: req.params.id });
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});

module.exports = router;