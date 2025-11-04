const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Category = require('../models/Category');

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
        
        // Get current month transactions
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
        
        // Extract totals
        const currentIncome = currentMonthStats.find(s => s._id === 'income')?.total || 0;
        const currentExpenses = currentMonthStats.find(s => s._id === 'expense')?.total || 0;
        const prevIncome = prevMonthStats.find(s => s._id === 'income')?.total || 0;
        const prevExpenses = prevMonthStats.find(s => s._id === 'expense')?.total || 0;
        
        // Calculate changes
        const incomeChange = currentIncome - prevIncome;
        const expenseChange = currentExpenses - prevExpenses;
        const incomeChangePercent = prevIncome > 0 ? ((incomeChange / prevIncome) * 100) : 0;
        const expenseChangePercent = prevExpenses > 0 ? ((expenseChange / prevExpenses) * 100) : 0;
        
        // Get expenses by category
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
            expensesByCategory,
            incomeByCategory,
            expensesByPerson,
            recentTransactions: formattedRecentTransactions,
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

module.exports = router;