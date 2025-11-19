const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const { getPaymentsAsTransactions, getAllBudgetData, aggregateAllFinancialData } = require('./analytics-adapter');

const router = express.Router();

// Get dashboard summary data
router.get('/summary', authMiddleware, async (req, res) => {
    try {
        const { month, year } = req.query;
        
        // Parse month and year or use current date
        const requestedMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const requestedYear = year ? parseInt(year) : new Date().getFullYear();
        
        // Calculate date ranges
        const startOfMonth = new Date(requestedYear, requestedMonth - 1, 1);
        const endOfMonth = new Date(requestedYear, requestedMonth, 0, 23, 59, 59);
        
        // Previous month for comparison
        const startOfPrevMonth = new Date(requestedYear, requestedMonth - 2, 1);
        const endOfPrevMonth = new Date(requestedYear, requestedMonth - 1, 0, 23, 59, 59);
        
        // Get current month transactions AND budget payments
        const currentMonthStats = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.userId),
                    date: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        // Get payments from budget system for current month
        const budgetPayments = await getPaymentsAsTransactions(req.userId, startOfMonth, endOfMonth);
        const budgetExpenses = budgetPayments.reduce((sum, payment) => sum + payment.amount, 0);
        console.log(`[Dashboard] Found ${budgetPayments.length} budget payments totaling ${budgetExpenses}`);
        
        // Get previous month transactions for comparison
        const prevMonthStats = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.userId),
                    date: {
                        $gte: startOfPrevMonth,
                        $lte: endOfPrevMonth
                    }
                }
            },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        // Get payments from budget system for previous month
        const prevBudgetPayments = await getPaymentsAsTransactions(req.userId, startOfPrevMonth, endOfPrevMonth);
        const prevBudgetExpenses = prevBudgetPayments.reduce((sum, payment) => sum + payment.amount, 0);
        
        // Extract totals (combine transactions + budget payments)
        const currentIncome = currentMonthStats.find(s => s._id === 'income')?.total || 0;
        const currentExpenses = (currentMonthStats.find(s => s._id === 'expense')?.total || 0) + budgetExpenses;
        const prevIncome = prevMonthStats.find(s => s._id === 'income')?.total || 0;
        const prevExpenses = (prevMonthStats.find(s => s._id === 'expense')?.total || 0) + prevBudgetExpenses;
        
        // Calculate changes
        const incomeChange = currentIncome - prevIncome;
        const expenseChange = currentExpenses - prevExpenses;
        const incomeChangePercent = prevIncome > 0 ? ((incomeChange / prevIncome) * 100) : 0;
        const expenseChangePercent = prevExpenses > 0 ? ((expenseChange / prevExpenses) * 100) : 0;
        
        // Get expenses by category (combine transactions + budget payments)
        const expensesByCategory = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.userId),
                    type: 'expense',
                    date: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: '$categoryId',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $project: {
                    id: '$_id',
                    name: '$category.name',
                    color: '$category.color',
                    icon: '$category.icon',
                    total: 1,
                    count: 1
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);
        
        // Add budget payments to expenses by category
        const categoryExpenseMap = new Map();
        
        // Add transaction expenses
        for (const cat of expensesByCategory) {
            categoryExpenseMap.set(cat.id.toString(), {
                id: cat.id,
                name: cat.name,
                color: cat.color,
                icon: cat.icon,
                total: cat.total,
                count: cat.count
            });
        }
        
        // Add budget payment expenses
        for (const payment of budgetPayments) {
            if (payment.categoryId) {
                const catId = payment.categoryId._id.toString();
                if (categoryExpenseMap.has(catId)) {
                    categoryExpenseMap.get(catId).total += payment.amount;
                    categoryExpenseMap.get(catId).count += 1;
                } else {
                    categoryExpenseMap.set(catId, {
                        id: payment.categoryId._id,
                        name: payment.categoryId.name,
                        color: payment.categoryId.color,
                        icon: payment.categoryId.icon,
                        total: payment.amount,
                        count: 1
                    });
                }
            }
        }
        
        // Convert map back to array and sort
        const finalExpensesByCategory = Array.from(categoryExpenseMap.values()).sort((a, b) => b.total - a.total);
        
        // Get income by category
        const incomeByCategory = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(req.userId),
                    type: 'income',
                    date: {
                        $gte: startOfMonth,
                        $lte: endOfMonth
                    }
                }
            },
            {
                $group: {
                    _id: '$categoryId',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $project: {
                    id: '$_id',
                    name: '$category.name',
                    color: '$category.color',
                    icon: '$category.icon',
                    total: 1,
                    count: 1
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);
        
        // Get recent transactions
        const recentTransactions = await Transaction.find({ 
            userId: new mongoose.Types.ObjectId(req.userId) 
        })
            .populate('categoryId')
            .sort({ date: -1, createdAt: -1 })
            .limit(10);
        
        // Format recent transactions
        const formattedRecentTransactions = recentTransactions.map(t => ({
            id: t._id,
            amount: t.amount,
            category_name: t.categoryId?.name || 'Unknown',
            description: t.description,
            date: t.date,
            type: t.type,
            icon: t.categoryId?.icon || '📄',
            color: t.categoryId?.color || '#808080',
            person: '' // Removed person field
        }));
        
        // Get recent budget payments (last 30 days for recent activity)
        const recentBudgetPayments = await getPaymentsAsTransactions(
            req.userId,
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            new Date()
        );
        
        // Format and combine recent activities
        const formattedBudgetPayments = recentBudgetPayments.map(p => ({
            id: p._id,
            amount: p.amount,
            category_name: p.categoryId?.name || 'Unknown',
            description: p.description,
            date: p.date,
            type: 'expense',
            icon: p.categoryId?.icon || '💳',
            color: p.categoryId?.color || '#808080',
            person: ''
        }));
        
        // Combine and sort all recent activities
        const allRecentTransactions = [...formattedRecentTransactions, ...formattedBudgetPayments]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10);
        
        // Get monthly trend (last 6 months)
        const monthlyTrend = [];
        for (let i = 5; i >= 0; i--) {
            const trendDate = new Date(requestedYear, requestedMonth - 1 - i, 1);
            const trendYear = trendDate.getFullYear();
            const trendMonth = trendDate.getMonth();
            
            const monthStart = new Date(trendYear, trendMonth, 1);
            const monthEnd = new Date(trendYear, trendMonth + 1, 0, 23, 59, 59);
            
            const monthStats = await Transaction.aggregate([
                {
                    $match: {
                        userId: new mongoose.Types.ObjectId(req.userId),
                        date: {
                            $gte: monthStart,
                            $lte: monthEnd
                        }
                    }
                },
                {
                    $group: {
                        _id: '$type',
                        total: { $sum: '$amount' }
                    }
                }
            ]);
            
            const monthIncome = monthStats.find(s => s._id === 'income')?.total || 0;
            const monthExpenses = monthStats.find(s => s._id === 'expense')?.total || 0;
            
            monthlyTrend.push({
                month: `${trendYear}-${String(trendMonth + 1).padStart(2, '0')}`,
                income: monthIncome,
                expenses: monthExpenses
            });
        }
        
        // Get active budgets with progress
        const budgets = await Budget.find({
            userId: req.userId,
            isActive: true,
            startDate: { $lte: endOfMonth },
            endDate: { $gte: startOfMonth }
        }).populate('categoryId');
        
        const budgetsWithProgress = await Promise.all(
            budgets.map(async (budget) => {
                const spent = await Transaction.aggregate([
                    {
                        $match: {
                            userId: new mongoose.Types.ObjectId(req.userId),
                            categoryId: budget.categoryId._id,
                            type: 'expense',
                            date: {
                                $gte: budget.startDate > startOfMonth ? budget.startDate : startOfMonth,
                                $lte: budget.endDate < endOfMonth ? budget.endDate : endOfMonth
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
                
                return {
                    id: budget._id,
                    category_name: budget.categoryId.name,
                    category_color: budget.categoryId.color,
                    category_icon: budget.categoryId.icon,
                    amount: budget.amount,
                    spent: spentAmount,
                    percentage: percentage,
                    period: budget.period,
                    alert_threshold: budget.alertThreshold,
                    alert_enabled: budget.alertEnabled
                };
            })
        );
        
        // Expenses by person (empty since we removed person field)
        const expensesByPerson = [];
        
        // Format response
        res.json({
            summary: {
                totalIncome: currentIncome,
                totalExpenses: currentExpenses,
                balance: currentIncome - currentExpenses,
                month: requestedMonth,
                year: requestedYear
            },
            comparison: {
                incomeChange,
                incomeChangePercent,
                expenseChange,
                expenseChangePercent
            },
            expensesByCategory: finalExpensesByCategory,
            incomeByCategory,
            expensesByPerson,
            recentTransactions: allRecentTransactions,
            monthlyTrend,
            budgets: budgetsWithProgress,
            goals: [] // TODO: Implement goals/savings feature
        });
        
    } catch (error) {
        console.error('Get dashboard summary error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get full dashboard data (backward compatibility)
router.get('/', authMiddleware, async (req, res) => {
    try {
        // Redirect to summary endpoint
        req.query = req.query || {};
        return router.handle(req, res);
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get available income (income - budgeted amount)
router.get('/available-income', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        
        // Get total income from all time
        const incomeStats = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: 'income'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        const totalIncome = incomeStats[0]?.total || 0;
        
        // Debug: Get all transactions to see what we have
        const allTransactions = await Transaction.find({ 
            userId: new mongoose.Types.ObjectId(userId) 
        }).select('type amount date description');
        
        console.log(`[Available Income Debug] Found ${allTransactions.length} total transactions`);
        console.log(`[Available Income Debug] Income transactions:`, allTransactions.filter(t => t.type === 'income'));
        console.log(`[Available Income Debug] Transaction types:`, allTransactions.map(t => t.type));
        
        // Get total allocated to budgets
        const MainBudget = require('../models/MainBudget');
        const mainBudgets = await MainBudget.find({ userId });
        
        let totalAllocated = 0;
        for (const budget of mainBudgets) {
            totalAllocated += budget.totalBudget || 0;
        }
        
        // Also include standalone weekly budgets not linked to main budgets
        const WeeklyBudget = require('../models/WeeklyBudget');
        const standaloneWeeklyBudgets = await WeeklyBudget.find({ 
            userId,
            parentBudgetId: { $exists: false }
        });
        
        for (const budget of standaloneWeeklyBudgets) {
            totalAllocated += budget.totalBudget || 0;
        }
        
        // Get total expenses (transactions + paid budget payments)
        const expenseStats = await Transaction.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    type: 'expense'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        const totalExpenses = expenseStats[0]?.total || 0;
        
        // Get paid budget payments
        const paidBudgetPayments = await getPaymentsAsTransactions(
            userId,
            new Date(0), // From beginning of time
            new Date() // To now
        );
        const totalBudgetExpenses = paidBudgetPayments.reduce((sum, p) => sum + p.amount, 0);
        
        // Calculate available (Income - Expenses - Allocated to future budgets)
        // This gives a more accurate picture of what's truly available
        const totalSpent = totalExpenses + totalBudgetExpenses;
        const netIncome = totalIncome - totalSpent;
        const available = netIncome - totalAllocated;
        
        console.log(`[Available Income] User ${userId}:`);
        console.log(`  - Total Income: ${totalIncome}`);
        console.log(`  - Total Expenses: ${totalExpenses}`);
        console.log(`  - Budget Expenses: ${totalBudgetExpenses}`);
        console.log(`  - Total Spent: ${totalSpent}`);
        console.log(`  - Net Income: ${netIncome}`);
        console.log(`  - Allocated to Budgets: ${totalAllocated}`);
        console.log(`  - Available: ${available}`);
        
        res.json({
            total: totalIncome,
            allocated: totalAllocated,
            available: available
        });
    } catch (error) {
        console.error('Get available income error:', error);
        res.status(500).json({ error: 'Failed to calculate available income' });
    }
});

module.exports = router;