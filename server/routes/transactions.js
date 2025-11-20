const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const { createNotification } = require('./notifications');
const { getIo } = require('../utils/socketManager');

const router = express.Router();

// Import budget models
const WeeklyBudget = require('../models/WeeklyBudget');
const PaymentSchedule = require('../models/PaymentSchedule');

// Get current budget categories for quick transactions
router.get('/quick-categories', authMiddleware, async (req, res) => {
    try {
        // First, get all user categories
        const allCategories = await Category.find({
            $or: [
                { userId: null },
                { userId: req.userId }
            ]
        }).sort({ name: 1 }); // Sort alphabetically
        
        // Get current week's budget
        const currentBudget = await WeeklyBudget.getCurrentWeek(req.userId);
        
        if (!currentBudget || !currentBudget.categories || currentBudget.categories.length === 0) {
            // If no budget, return all categories
            return res.json({
                hasBudget: false,
                categories: allCategories
            });
        }

        // Populate categories from budget
        await currentBudget.populate('categories.categoryId');
        
        // Create a map of budget categories for quick lookup
        const budgetCategoryMap = new Map();
        currentBudget.categories.forEach(cat => {
            const spent = cat.payments
                .filter(p => p.status === 'paid')
                .reduce((sum, p) => sum + p.amount, 0);
            budgetCategoryMap.set(cat.categoryId._id.toString(), {
                allocation: cat.allocation,
                spent: spent,
                remaining: cat.allocation - spent
            });
        });
        
        // Enhance all categories with budget info if available
        const enhancedCategories = allCategories.map(cat => {
            const budgetInfo = budgetCategoryMap.get(cat._id.toString());
            if (budgetInfo) {
                return {
                    ...cat.toObject(),
                    ...budgetInfo,
                    inBudget: true
                };
            }
            return {
                ...cat.toObject(),
                allocation: 0,
                spent: 0,
                remaining: 0,
                inBudget: false
            };
        });

        res.json({
            hasBudget: true,
            budgetId: currentBudget._id,
            weekStart: currentBudget.weekStartDate,
            weekEnd: currentBudget.weekEndDate,
            categories: enhancedCategories
        });
    } catch (error) {
        console.error('Get quick categories error:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

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

// Quick transaction - links to current active budget
router.post('/quick', authMiddleware, async (req, res) => {
    try {
        const { amount, description, date, paymentMethod, tags, currency } = req.body;
        
        // Always use the Quick Payment category
        const quickPaymentCategory = await Category.findOne({
            name: 'Quick Payment',
            isSystem: true
        });
        
        if (!quickPaymentCategory) {
            return res.status(500).json({ error: 'Quick Payment category not found. Please restart the server.' });
        }
        
        const categoryId = quickPaymentCategory._id;

        // Validate input
        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be a valid number greater than 0' });
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

        // Get user's default currency
        const User = require('../models/User');
        const user = await User.findById(req.userId);
        const transactionCurrency = currency || user.currency || 'PEN';

        // Find current week's budget
        const currentBudget = await WeeklyBudget.getCurrentWeek(req.userId);
        
        // If no budget exists, return a response asking if user wants to create one
        if (!currentBudget) {
            return res.status(200).json({ 
                requiresBudget: true,
                message: 'No hay presupuesto activo. ¿Deseas crear un presupuesto rápido mensual?',
                transactionData: {
                    amount: numAmount,
                    categoryId,
                    description: description || `Quick payment`,
                    date: date || new Date(),
                    paymentMethod: paymentMethod || 'cash',
                    currency: transactionCurrency
                }
            });
        }
        
        console.log('Current budget found:', {
            id: currentBudget._id,
            categoriesCount: currentBudget.categories?.length,
            categoryIds: currentBudget.categories?.map(c => c.categoryId.toString())
        });
        
        // Create the transaction (always expense for quick transactions)
        const transaction = new Transaction({
            userId: req.userId,
            type: 'expense',
            amount: numAmount,
            currency: transactionCurrency,
            categoryId,
            description: description || `Quick payment - ${category.name}`,
            date: date ? new Date(date) : new Date(),
            paymentMethod: paymentMethod || 'cash',
            tags: tags || ['quick-payment'],
            isRecurring: false
        });

        await transaction.save();

        // If we have an active budget, create a payment entry and link it
        if (currentBudget) {
            // Check if this category exists in the budget
            const budgetCategory = currentBudget.categories.find(
                cat => cat.categoryId.toString() === categoryId.toString()
            );

            console.log('Budget category search:', {
                searchingFor: categoryId.toString(),
                found: !!budgetCategory,
                categoriesInBudget: currentBudget.categories.map(c => ({
                    id: c.categoryId.toString(),
                    name: c.categoryId.name || 'No name',
                    allocation: c.allocation
                }))
            });

            if (budgetCategory) {
                // If category has 0 allocation, set it to at least the payment amount
                if (!budgetCategory.allocation || budgetCategory.allocation === 0) {
                    budgetCategory.allocation = numAmount;
                    console.log('Updated category allocation to:', numAmount);
                }
                
                // Create a payment entry in the budget
                const payment = {
                    _id: new mongoose.Types.ObjectId(), // Generate a unique ID for the payment
                    name: description || `Quick payment`,
                    amount: numAmount,
                    scheduledDate: new Date(),
                    status: 'paid',
                    paidDate: new Date(),
                    paidBy: req.userId,
                    notes: `Created via quick transaction - ${transaction._id}`,
                    transactionId: transaction._id, // Link to the transaction
                    paymentScheduleId: null // No PaymentSchedule document for quick transactions
                };

                // Add payment to the category
                budgetCategory.payments.push(payment);
                
                // Update spent amount for the category
                const categoryAllocation = budgetCategory.allocation || 0;
                const currentSpent = budgetCategory.payments
                    .filter(p => p.status === 'paid')
                    .reduce((sum, p) => sum + p.amount, 0);
                
                console.log('Budget category before save:', {
                    categoryId: budgetCategory.categoryId.toString(),
                    paymentsCount: budgetCategory.payments.length,
                    totalSpent: currentSpent,
                    allocation: categoryAllocation
                });
                
                // Update remaining budget
                currentBudget.updateRemainingBudget();
                
                // Save the budget
                await currentBudget.save();
                
                console.log('Quick transaction linked to budget:', {
                    transactionId: transaction._id,
                    budgetId: currentBudget._id,
                    categoryId,
                    amount: numAmount,
                    paymentsInCategory: budgetCategory.payments.length
                });
                
                // Emit budget update event
                const io = getIo();
                if (io) {
                    io.to(`user_${req.userId}`).emit('budget-updated', currentBudget);
                }
            } else {
                console.log('Category not found in budget, adding it:', {
                    categoryId: categoryId.toString(),
                    budgetCategories: currentBudget.categories.map(c => c.categoryId.toString())
                });
                
                // Add the category to the budget
                currentBudget.categories.push({
                    categoryId: categoryId,
                    allocation: numAmount, // Set allocation to payment amount
                    payments: [{
                        _id: new mongoose.Types.ObjectId(),
                        name: description || `Quick payment`,
                        amount: numAmount,
                        scheduledDate: new Date(),
                        status: 'paid',
                        paidDate: new Date(),
                        paidBy: req.userId,
                        notes: `Created via quick transaction - ${transaction._id}`,
                        transactionId: transaction._id,
                        paymentScheduleId: null
                    }]
                });
                
                // Update remaining budget
                currentBudget.updateRemainingBudget();
                
                // Save the budget
                await currentBudget.save();
                
                console.log('Added new category to budget with quick payment');
                
                // Emit budget update event
                const io = getIo();
                if (io) {
                    io.to(`user_${req.userId}`).emit('budget-updated', currentBudget);
                }
            }
        }

        // Populate category for response
        await transaction.populate('categoryId');

        // Emit socket event
        const io = getIo();
        if (io) {
            io.to(`user_${req.userId}`).emit('transaction-created', transaction);
        }

        res.status(201).json({
            transaction,
            budgetLinked: !!currentBudget,
            message: currentBudget ? 
                'Transaction created and linked to current budget' : 
                'Transaction created (no active budget found)'
        });
    } catch (error) {
        console.error('Quick transaction error:', error);
        res.status(500).json({ error: 'Failed to create quick transaction' });
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