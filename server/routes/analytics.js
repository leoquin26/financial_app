const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const PaymentSchedule = require('../models/PaymentSchedule');
const MainBudget = require('../models/MainBudget');
const WeeklyBudget = require('../models/WeeklyBudget');
const { getPaymentsAsTransactions, getAllBudgetData, aggregateAllFinancialData } = require('./analytics-adapter');

const router = express.Router();

// Get comprehensive analytics data
router.get('/overview', authMiddleware, async (req, res) => {
    try {
        const { startDate, endDate, period = 'month' } = req.query;
        
        // Parse dates or use defaults (last 12 months)
        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
        
        const userId = new mongoose.Types.ObjectId(req.userId);
        
        // Helper function to aggregate data from both Transaction and PaymentSchedule
        const aggregateFinancialData = async (match, group) => {
            // Get data from Transaction model
            const transactionData = await Transaction.aggregate([
                { $match: match },
                { $group: group }
            ]);
            
            // Get data from PaymentSchedule model (paid payments)
            const paymentData = await PaymentSchedule.aggregate([
                { 
                    $match: {
                        ...match,
                        status: 'paid',
                        paidDate: match.date // Use paidDate instead of date
                    }
                },
                { $group: group }
            ]);
            
            // Combine results
            const combined = {};
            [...transactionData, ...paymentData].forEach(item => {
                const key = item._id || 'all';
                if (!combined[key]) {
                    combined[key] = { ...item };
                } else {
                    // Merge data
                    combined[key].total = (combined[key].total || 0) + (item.total || 0);
                    combined[key].count = (combined[key].count || 0) + (item.count || 0);
                    if (item.average) {
                        combined[key].average = ((combined[key].average || 0) + item.average) / 2;
                    }
                    if (item.min !== undefined) {
                        combined[key].min = Math.min(combined[key].min || Infinity, item.min);
                    }
                    if (item.max !== undefined) {
                        combined[key].max = Math.max(combined[key].max || -Infinity, item.max);
                    }
                }
            });
            
            return Object.values(combined);
        };
        
        // 1. Income vs Expenses Overview
        // Get overview stats from aggregated data (includes budget payments)
        const allFinancialOverview = await aggregateAllFinancialData(userId, start, end, 'type');
        
        const overviewStats = Object.keys(allFinancialOverview).map(type => ({
            _id: type,
            total: allFinancialOverview[type].total,
            count: allFinancialOverview[type].count,
            average: allFinancialOverview[type].average,
            min: Math.min(...allFinancialOverview[type].items.map(item => item.amount)),
            max: Math.max(...allFinancialOverview[type].items.map(item => item.amount))
        }));
        
        // 2. Monthly/Weekly/Daily Trends
        const trendData = await getTrendData(userId, start, end, period);
        
        // 3. Category Analysis - including data from all sources
        const allFinancialData = await aggregateAllFinancialData(userId, start, end, 'type');
        
        // Get category breakdown
        const categoryData = await aggregateAllFinancialData(userId, start, end, item => 
            `${item.categoryId?._id || 'uncategorized'}_${item.type}`
        );
        
        const categoryAnalysis = [];
        for (const key in categoryData) {
            const [categoryId, type] = key.split('_');
            if (categoryId !== 'uncategorized') {
                const category = await Category.findById(categoryId);
                if (category) {
                    categoryAnalysis.push({
                        categoryId: category._id,
                        categoryName: category.name,
                        categoryColor: category.color,
                        categoryIcon: category.icon,
                        type: type,
                        total: categoryData[key].total,
                        count: categoryData[key].count,
                        average: categoryData[key].average
                    });
                }
            }
        }
        
        console.log('[Analytics] Overview stats:', overviewStats);
        
        // Legacy category analysis for comparison
        const legacyCategoryAnalysis = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        categoryId: '$categoryId',
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 },
                    average: { $avg: '$amount' }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id.categoryId',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            {
                $unwind: '$category'
            },
            {
                $project: {
                    categoryId: '$_id.categoryId',
                    categoryName: '$category.name',
                    categoryColor: '$category.color',
                    categoryIcon: '$category.icon',
                    type: '$_id.type',
                    total: 1,
                    count: 1,
                    average: 1
                }
            },
            {
                $sort: { total: -1 }
            }
        ]);
        
        // 4. Top Transactions - including payments
        const transactions = await Transaction.find({
            userId,
            date: { $gte: start, $lte: end }
        }).populate('categoryId');
        
        const payments = await getPaymentsAsTransactions(userId, start, end);
        
        // Combine and sort all transactions
        const allTransactions = [...transactions, ...payments]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);
        
        // 5. Savings Rate
        console.log('[Analytics] All financial overview:', JSON.stringify(allFinancialOverview, null, 2));
        console.log('[Analytics] Overview stats before processing:', JSON.stringify(overviewStats, null, 2));
        
        const incomeTotal = overviewStats.find(s => s._id === 'income')?.total || 0;
        const expenseTotal = overviewStats.find(s => s._id === 'expense')?.total || 0;
        
        console.log('[Analytics] Income total:', incomeTotal);
        console.log('[Analytics] Expense total:', expenseTotal);
        
        const savingsRate = incomeTotal > 0 ? ((incomeTotal - expenseTotal) / incomeTotal * 100) : 0;
        
        // 6. Budget Performance - from all budget types
        const budgetPerformance = await getAllBudgetData(userId, start, end);
        
        // 7. Day of Week Analysis
        const dayOfWeekAnalysis = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: start, $lte: end }
                }
            },
            {
                $group: {
                    _id: {
                        dayOfWeek: { $dayOfWeek: '$date' },
                        type: '$type'
                    },
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.dayOfWeek': 1 }
            }
        ]);
        
        // 8. Month over Month Growth
        const monthGrowth = await getMonthOverMonthGrowth(userId, start, end);
        
        res.json({
            period: { start, end },
            overview: {
                income: overviewStats.find(s => s._id === 'income') || { total: 0, count: 0, average: 0 },
                expense: overviewStats.find(s => s._id === 'expense') || { total: 0, count: 0, average: 0 },
                balance: incomeTotal - expenseTotal,
                savingsRate
            },
            trends: trendData,
            categoryBreakdown: categoryAnalysis,
            topTransactions: allTransactions.map(t => ({
                id: t._id,
                amount: t.amount,
                type: t.type,
                category: t.categoryId?.name || 'Unknown',
                categoryColor: t.categoryId?.color || '#808080',
                categoryIcon: t.categoryId?.icon || '📄',
                description: t.description,
                date: t.date
            })),
            budgetPerformance,
            dayOfWeekAnalysis: formatDayOfWeekData(dayOfWeekAnalysis),
            monthGrowth
        });
        
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
});

// Get financial insights and recommendations
router.get('/insights', authMiddleware, async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.userId);
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        
        // Recent spending patterns
        const recentSpending = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'expense',
                    date: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    daily: { $avg: '$amount' }
                }
            }
        ]);
        
        // Previous period spending
        const previousSpending = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'expense',
                    date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        // Unusual transactions (outliers)
        const avgTransaction = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    date: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: '$type',
                    avg: { $avg: '$amount' },
                    stdDev: { $stdDevPop: '$amount' }
                }
            }
        ]);
        
        const insights = [];
        
        // Spending trend insight
        const currentTotal = recentSpending[0]?.total || 0;
        const previousTotal = previousSpending[0]?.total || 0;
        const spendingChange = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal * 100) : 0;
        
        if (Math.abs(spendingChange) > 20) {
            insights.push({
                type: spendingChange > 0 ? 'warning' : 'success',
                title: spendingChange > 0 ? 'Aumento en gastos' : 'Reducción en gastos',
                message: `Tus gastos han ${spendingChange > 0 ? 'aumentado' : 'disminuido'} un ${Math.abs(spendingChange).toFixed(1)}% en los últimos 30 días`,
                priority: 'high'
            });
        }
        
        // Budget alerts
        const budgets = await Budget.find({
            userId,
            isActive: true,
            endDate: { $gte: now }
        }).populate('categoryId');
        
        for (const budget of budgets) {
            const spent = await Transaction.aggregate([
                {
                    $match: {
                        userId,
                        categoryId: budget.categoryId._id,
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
            
            if (percentage >= 90) {
                insights.push({
                    type: 'error',
                    title: `Presupuesto casi agotado`,
                    message: `Has usado el ${percentage.toFixed(0)}% de tu presupuesto de ${budget.categoryId.name}`,
                    priority: 'high'
                });
            } else if (percentage >= 70) {
                insights.push({
                    type: 'warning',
                    title: `Presupuesto en alerta`,
                    message: `Has usado el ${percentage.toFixed(0)}% de tu presupuesto de ${budget.categoryId.name}`,
                    priority: 'medium'
                });
            }
        }
        
        // Category recommendations
        const topCategories = await Transaction.aggregate([
            {
                $match: {
                    userId,
                    type: 'expense',
                    date: { $gte: thirtyDaysAgo }
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
                $sort: { total: -1 }
            },
            {
                $limit: 3
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
            }
        ]);
        
        if (topCategories.length > 0) {
            const topCategory = topCategories[0];
            insights.push({
                type: 'info',
                title: 'Mayor categoría de gastos',
                message: `${topCategory.category.name} representa tu mayor gasto con $${topCategory.total.toFixed(2)} en los últimos 30 días`,
                priority: 'low'
            });
        }
        
        res.json({ insights });
        
    } catch (error) {
        console.error('Get insights error:', error);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
});

// Helper function to get trend data from both Transaction and PaymentSchedule
async function getTrendData(userId, start, end, period) {
    let groupBy;
    
    switch (period) {
        case 'day':
            groupBy = {
                year: { $year: '$date' },
                month: { $month: '$date' },
                day: { $dayOfMonth: '$date' }
            };
            break;
        case 'week':
            groupBy = {
                year: { $year: '$date' },
                week: { $week: '$date' }
            };
            break;
        case 'month':
        default:
            groupBy = {
                year: { $year: '$date' },
                month: { $month: '$date' }
            };
            break;
    }
    
    const trends = await Transaction.aggregate([
        {
            $match: {
                userId,
                date: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: {
                    ...groupBy,
                    type: '$type'
                },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: {
                '_id.year': 1,
                '_id.month': 1,
                '_id.day': 1
            }
        }
    ]);
    
    return formatTrendData(trends, period);
}

// Helper function to format trend data
function formatTrendData(data, period) {
    const formatted = {};
    
    data.forEach(item => {
        let key;
        if (period === 'day') {
            key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
        } else if (period === 'week') {
            key = `${item._id.year}-W${String(item._id.week).padStart(2, '0')}`;
        } else {
            key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        }
        
        if (!formatted[key]) {
            formatted[key] = { date: key, income: 0, expense: 0 };
        }
        
        formatted[key][item._id.type] = item.total;
    });
    
    return Object.values(formatted).sort((a, b) => a.date.localeCompare(b.date));
}

// Helper function to get budget performance from all budget types
async function getBudgetPerformance(userId, start, end) {
    // Get old Budget model data
    const oldBudgets = await Budget.find({
        userId,
        $or: [
            { startDate: { $lte: end }, endDate: { $gte: start } },
            { startDate: { $gte: start, $lte: end } }
        ]
    }).populate('categoryId');
    
    // Get MainBudget data
    const mainBudgets = await MainBudget.find({
        userId,
        createdAt: { $lte: end }
    }).populate('categories.categoryId');
    
    // Get WeeklyBudget data
    const weeklyBudgets = await WeeklyBudget.find({
        userId,
        weekStartDate: { $lte: end },
        weekEndDate: { $gte: start }
    }).populate('categories.categoryId');
    
    const performance = await Promise.all(
        budgets.map(async (budget) => {
            const spent = await Transaction.aggregate([
                {
                    $match: {
                        userId,
                        categoryId: budget.categoryId._id,
                        type: 'expense',
                        date: {
                            $gte: budget.startDate > start ? budget.startDate : start,
                            $lte: budget.endDate < end ? budget.endDate : end
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
                category: budget.categoryId.name,
                categoryColor: budget.categoryId.color,
                categoryIcon: budget.categoryId.icon,
                budgeted: budget.amount,
                spent: spentAmount,
                remaining: budget.amount - spentAmount,
                percentage,
                period: budget.period,
                status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'good'
            };
        })
    );
    
    return performance;
}

// Helper function to format day of week data
function formatDayOfWeekData(data) {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const formatted = {};
    
    // Initialize all days
    days.forEach((day, index) => {
        formatted[index + 1] = {
            day,
            income: 0,
            expense: 0
        };
    });
    
    // Fill with actual data
    data.forEach(item => {
        const dayIndex = item._id.dayOfWeek;
        formatted[dayIndex][item._id.type] = item.total;
    });
    
    return Object.values(formatted);
}

// Helper function to get month over month growth
async function getMonthOverMonthGrowth(userId, start, end) {
    const monthlyData = await Transaction.aggregate([
        {
            $match: {
                userId,
                date: { $gte: start, $lte: end }
            }
        },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' },
                    type: '$type'
                },
                total: { $sum: '$amount' }
            }
        },
        {
            $sort: {
                '_id.year': 1,
                '_id.month': 1
            }
        }
    ]);
    
    const growth = [];
    const monthMap = {};
    
    // Organize data by month
    monthlyData.forEach(item => {
        const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
        if (!monthMap[key]) {
            monthMap[key] = { income: 0, expense: 0 };
        }
        monthMap[key][item._id.type] = item.total;
    });
    
    // Calculate growth rates
    const months = Object.keys(monthMap).sort();
    for (let i = 1; i < months.length; i++) {
        const current = monthMap[months[i]];
        const previous = monthMap[months[i - 1]];
        
        growth.push({
            month: months[i],
            incomeGrowth: previous.income > 0 ? ((current.income - previous.income) / previous.income * 100) : 0,
            expenseGrowth: previous.expense > 0 ? ((current.expense - previous.expense) / previous.expense * 100) : 0
        });
    }
    
    return growth;
}

module.exports = router;
