const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const { createNotification } = require('./notifications');
const { getIo } = require('../utils/socketManager');

const router = express.Router();

// Get all transactions for user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { 
            type, 
            categoryId, 
            startDate, 
            endDate, 
            minAmount, 
            maxAmount,
            page = 1,
            limit = 50
        } = req.query;

        // Build query
        const query = { userId: req.userId };

        if (type) query.type = type;
        if (categoryId) query.categoryId = categoryId;
        if (minAmount || maxAmount) {
            query.amount = {};
            if (minAmount) query.amount.$gte = parseFloat(minAmount);
            if (maxAmount) query.amount.$lte = parseFloat(maxAmount);
        }
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = new Date(startDate);
            if (endDate) query.date.$lte = new Date(endDate);
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get transactions with category details
        const transactions = await Transaction.find(query)
            .populate('categoryId')
            .sort({ date: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination
        const total = await Transaction.countDocuments(query);

        res.json({
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// Get single transaction
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.userId
        }).populate('categoryId');

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(transaction);
    } catch (error) {
        console.error('Get transaction error:', error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// Create transaction
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { type, amount, categoryId, description, date, householdId, isShared, 
                paymentMethod, tags, isRecurring, recurringPeriod, currency } = req.body;

        // Validate input
        if (!type || !amount || !categoryId) {
            return res.status(400).json({ error: 'Type, amount, and category are required' });
        }

        if (!['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'Invalid transaction type' });
        }

        // Ensure amount is a number
        const numAmount = parseFloat(amount);
        
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a valid number greater than 0' });
        }

        // Verify category exists and belongs to user or is default
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

        // Get user's default currency if not provided
        const User = require('../models/User');
        const user = await User.findById(req.userId);
        const transactionCurrency = currency || user.currency || 'PEN';

        // If shared, verify user has permission in household
        let sharedWith = [];
        if (householdId && isShared) {
            const Household = require('../models/Household');
            const household = await Household.findById(householdId);
            
            if (!household || !household.isMember(req.userId)) {
                return res.status(403).json({ error: 'Not authorized to add transactions to this household' });
            }
            
            if (!household.hasPermission(req.userId, 'canAddTransactions')) {
                return res.status(403).json({ error: 'You do not have permission to add transactions' });
            }
            
            // Get all household members except the creator
            sharedWith = household.members
                .filter(m => m.user.toString() !== req.userId)
                .map(m => m.user);
        }

        // Create transaction
        const transaction = new Transaction({
            userId: req.userId,
            householdId: householdId || null,
            isShared: isShared || false,
            sharedWith,
            type,
            amount: numAmount,
            currency: transactionCurrency,
            categoryId,
            description: description || '',
            date: date ? new Date(date) : new Date(),
            paymentMethod: paymentMethod || '',
            tags: tags || [],
            isRecurring: isRecurring || false,
            recurringPeriod: recurringPeriod || 'monthly'
        });

        await transaction.save();

        // Populate category for response
        await transaction.populate('categoryId');

        // Check budget alerts
        if (type === 'expense') {
            const budgets = await Budget.find({
                userId: req.userId,
                categoryId,
                isActive: true,
                alertEnabled: true
            });

            for (const budget of budgets) {
                // Calculate spent amount for this budget period
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

                const spentAmount = spent[0]?.total || 0;
                const percentage = (spentAmount / budget.amount) * 100;

                if (percentage >= budget.alertThreshold) {
                    // Create notification
                    await createNotification(
                        req.userId,
                        'budget_alert',
                        '⚠️ Alerta de Presupuesto',
                        `Has alcanzado el ${percentage.toFixed(0)}% de tu presupuesto de ${category.name}`,
                        { budgetId: budget._id, categoryId, percentage }
                    );

                    // Emit socket event
                    const io = getIo();
                    if (io) {
                        io.to(`user_${req.userId}`).emit('budget-alert', {
                            budgetId: budget._id,
                            categoryName: category.name,
                            percentage,
                            spent: spentAmount,
                            budget: budget.amount
                        });
                    }
                }
            }
        }

        // Create notification for significant transactions
        if ((type === 'expense' && numAmount >= 500) || (type === 'income' && numAmount >= 1000)) {
            const title = type === 'income' ? '💰 Ingreso Significativo' : '💸 Gasto Significativo';
            const message = `${type === 'income' ? 'Ingreso' : 'Gasto'} de $${numAmount.toFixed(2)} en ${category.name}`;
            
            await createNotification(
                req.userId,
                'transaction',
                title,
                message,
                { transactionId: transaction._id, amount: numAmount, categoryName: category.name }
            );
        }

        // Emit socket event for real-time update
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('transaction-created', transaction);
        }

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});

// Update transaction
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { type, amount, categoryId, description, date, 
                paymentMethod, tags, isRecurring, recurringPeriod, currency } = req.body;

        // Find transaction
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Validate and update fields
        if (type !== undefined) {
            if (!['income', 'expense'].includes(type)) {
                return res.status(400).json({ error: 'Invalid transaction type' });
            }
            transaction.type = type;
        }

        if (amount !== undefined) {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                return res.status(400).json({ error: 'Amount must be a valid number greater than 0' });
            }
            transaction.amount = numAmount;
        }

        if (categoryId !== undefined) {
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
            transaction.categoryId = categoryId;
        }

        if (description !== undefined) transaction.description = description;
        if (date !== undefined) transaction.date = new Date(date);
        if (paymentMethod !== undefined) transaction.paymentMethod = paymentMethod;
        if (tags !== undefined) transaction.tags = tags;
        if (isRecurring !== undefined) transaction.isRecurring = isRecurring;
        if (recurringPeriod !== undefined) transaction.recurringPeriod = recurringPeriod;
        if (currency !== undefined) {
            if (!['USD', 'PEN'].includes(currency)) {
                return res.status(400).json({ error: 'Invalid currency' });
            }
            transaction.currency = currency;
        }

        await transaction.save();
        await transaction.populate('categoryId');

        // Emit socket event for real-time update
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('transaction-updated', transaction);
        }

        res.json(transaction);
    } catch (error) {
        console.error('Update transaction error:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// Bulk delete transactions
router.post('/bulk-delete', authMiddleware, async (req, res) => {
    try {
        const { ids } = req.body;
        
        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No transaction IDs provided' });
        }
        
        // Validate all IDs
        const invalidIds = ids.filter(id => !id || id === 'undefined');
        if (invalidIds.length > 0) {
            return res.status(400).json({ error: 'Invalid transaction IDs provided' });
        }
        
        // Delete only transactions that belong to the user
        const result = await Transaction.deleteMany({
            _id: { $in: ids },
            userId: req.userId
        });
        
        // Emit socket event for real-time update
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('transactions-deleted', { ids, count: result.deletedCount });
        }
        
        res.json({ 
            message: `${result.deletedCount} transactions deleted successfully`,
            deletedCount: result.deletedCount 
        });
    } catch (error) {
        console.error('Bulk delete transactions error:', error);
        res.status(500).json({ error: 'Failed to delete transactions' });
    }
});

// Delete transaction
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        // Validate ID
        if (!req.params.id || req.params.id === 'undefined') {
            return res.status(400).json({ error: 'Transaction ID is required' });
        }

        const transaction = await Transaction.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        await Transaction.deleteOne({ _id: req.params.id });

        // Emit socket event for real-time update
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('transaction-deleted', { id: req.params.id });
        }

        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// Get transaction statistics
router.get('/stats/summary', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const matchQuery = { userId: req.userId };
        if (startDate || endDate) {
            matchQuery.date = {};
            if (startDate) matchQuery.date.$gte = new Date(startDate);
            if (endDate) matchQuery.date.$lte = new Date(endDate);
        }

        const stats = await Transaction.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    average: { $avg: '$amount' }
                }
            }
        ]);

        const result = {
            income: { total: 0, count: 0, average: 0 },
            expense: { total: 0, count: 0, average: 0 },
            balance: 0
        };

        stats.forEach(stat => {
            result[stat._id] = {
                total: stat.total,
                count: stat.count,
                average: stat.average
            };
        });

        result.balance = result.income.total - result.expense.total;

        res.json(result);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;