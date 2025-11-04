const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { getIo } = require('../utils/socketManager');

const router = express.Router();

// Get all budgets for user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const budgets = await Budget.find({ userId: req.userId })
            .populate('categoryId')
            .sort({ createdAt: -1 });

        // Calculate spent amount for each budget
        const budgetsWithSpent = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await Transaction.aggregate([
                    {
                        $match: {
                            userId: req.userId,
                            categoryId: budget.categoryId,
                            type: 'expense',
                            date: {
                                $gte: budget.startDate,
                                $lte: budget.endDate
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            total: { $sum: '$amount' }
                        }
                    }
                ]);

                return {
                    ...budget.toObject(),
                    spent: spent[0]?.total || 0,
                    remaining: budget.amount - (spent[0]?.total || 0),
                    percentage: ((spent[0]?.total || 0) / budget.amount) * 100
                };
            })
        );

        res.json(budgetsWithSpent);
    } catch (error) {
        console.error('Get budgets error:', error);
        res.status(500).json({ error: 'Failed to fetch budgets' });
    }
});

// Get single budget
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const budget = await Budget.findOne({
            _id: req.params.id,
            userId: req.userId
        }).populate('categoryId');

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        // Calculate spent amount
        const spent = await Transaction.aggregate([
            {
                $match: {
                    userId: req.userId,
                    categoryId: budget.categoryId,
                    type: 'expense',
                    date: {
                        $gte: budget.startDate,
                        $lte: budget.endDate
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const budgetWithSpent = {
            ...budget.toObject(),
            spent: spent[0]?.total || 0,
            remaining: budget.amount - (spent[0]?.total || 0),
            percentage: ((spent[0]?.total || 0) / budget.amount) * 100
        };

        res.json(budgetWithSpent);
    } catch (error) {
        console.error('Get budget error:', error);
        res.status(500).json({ error: 'Failed to fetch budget' });
    }
});

// Create budget
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { 
            categoryId, 
            amount, 
            period, 
            startDate, 
            endDate, 
            alertThreshold,
            alertEnabled 
        } = req.body;

        // Validate input
        if (!categoryId || !amount || !period) {
            return res.status(400).json({ error: 'Category, amount, and period are required' });
        }

        if (!['monthly', 'yearly'].includes(period)) {
            return res.status(400).json({ error: 'Invalid period' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }

        // Verify category exists
        const category = await Category.findOne({
            _id: categoryId,
            $or: [
                { userId: null },
                { userId: req.userId }
            ]
        });

        if (!category) {
            return res.status(400).json({ error: 'Invalid category' });
        }

        // Check for existing active budget for this category
        const existingBudget = await Budget.findOne({
            userId: req.userId,
            categoryId,
            isActive: true,
            endDate: { $gte: new Date() }
        });

        if (existingBudget) {
            return res.status(400).json({ error: 'An active budget already exists for this category' });
        }

        // Calculate dates if not provided
        let budgetStartDate = startDate ? new Date(startDate) : new Date();
        let budgetEndDate;

        if (endDate) {
            budgetEndDate = new Date(endDate);
        } else {
            budgetEndDate = new Date(budgetStartDate);
            if (period === 'monthly') {
                budgetEndDate.setMonth(budgetEndDate.getMonth() + 1);
            } else {
                budgetEndDate.setFullYear(budgetEndDate.getFullYear() + 1);
            }
        }

        // Create budget
        const budget = new Budget({
            userId: req.userId,
            categoryId,
            amount,
            period,
            startDate: budgetStartDate,
            endDate: budgetEndDate,
            alertThreshold: alertThreshold || 80,
            alertEnabled: alertEnabled !== false
        });

        await budget.save();
        await budget.populate('categoryId');

        // Emit socket event
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('budget-created', budget);
        }

        res.status(201).json(budget);
    } catch (error) {
        console.error('Create budget error:', error);
        res.status(500).json({ error: 'Failed to create budget' });
    }
});

// Update budget
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const budget = await Budget.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        const { 
            amount, 
            period, 
            startDate, 
            endDate, 
            alertThreshold,
            alertEnabled,
            isActive
        } = req.body;

        // Update fields
        if (amount !== undefined) {
            if (amount <= 0) {
                return res.status(400).json({ error: 'Amount must be greater than 0' });
            }
            budget.amount = amount;
        }

        if (period !== undefined) {
            if (!['monthly', 'yearly'].includes(period)) {
                return res.status(400).json({ error: 'Invalid period' });
            }
            budget.period = period;
        }

        if (startDate !== undefined) budget.startDate = new Date(startDate);
        if (endDate !== undefined) budget.endDate = new Date(endDate);
        if (alertThreshold !== undefined) budget.alertThreshold = alertThreshold;
        if (alertEnabled !== undefined) budget.alertEnabled = alertEnabled;
        if (isActive !== undefined) budget.isActive = isActive;

        await budget.save();
        await budget.populate('categoryId');

        // Emit socket event
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('budget-updated', budget);
        }

        res.json(budget);
    } catch (error) {
        console.error('Update budget error:', error);
        res.status(500).json({ error: 'Failed to update budget' });
    }
});

// Delete budget
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const budget = await Budget.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!budget) {
            return res.status(404).json({ error: 'Budget not found' });
        }

        await Budget.deleteOne({ _id: req.params.id });

        // Emit socket event
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('budget-deleted', { id: req.params.id });
        }

        res.json({ message: 'Budget deleted successfully' });
    } catch (error) {
        console.error('Delete budget error:', error);
        res.status(500).json({ error: 'Failed to delete budget' });
    }
});

module.exports = router;