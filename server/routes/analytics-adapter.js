const Transaction = require('../models/Transaction');
const PaymentSchedule = require('../models/PaymentSchedule');
const WeeklyBudget = require('../models/WeeklyBudget');
const MainBudget = require('../models/MainBudget');

/**
 * Adapter to convert new budget/payment system data to analytics format
 */

// Convert WeeklyBudget payments to transaction-like format for analytics
async function getPaymentsAsTransactions(userId, startDate, endDate) {
    const weeklyBudgets = await WeeklyBudget.find({
        userId,
        weekStartDate: { $lte: endDate },
        weekEndDate: { $gte: startDate }
    }).populate('categories.categoryId');

    const transactions = [];

    for (const budget of weeklyBudgets) {
        for (const category of budget.categories) {
            for (const payment of category.payments) {
                if (payment.status === 'paid' && payment.scheduledDate >= startDate && payment.scheduledDate <= endDate) {
                    transactions.push({
                        _id: payment._id,
                        userId: budget.userId,
                        amount: payment.amount,
                        type: 'expense',
                        categoryId: category.categoryId,
                        description: payment.name,
                        date: payment.scheduledDate,
                        paidDate: payment.paidDate || payment.scheduledDate,
                        paidBy: payment.paidBy,
                        status: payment.status
                    });
                }
            }
        }
    }

    // Also get PaymentSchedule data
    const scheduledPayments = await PaymentSchedule.find({
        userId,
        status: 'paid',
        paidDate: { $gte: startDate, $lte: endDate }
    }).populate('categoryId');

    for (const payment of scheduledPayments) {
        transactions.push({
            _id: payment._id,
            userId: payment.userId,
            amount: payment.amount,
            type: payment.type || 'expense',
            categoryId: payment.categoryId,
            description: payment.name,
            date: payment.paidDate,
            paidDate: payment.paidDate,
            paidBy: payment.paidBy,
            status: payment.status
        });
    }

    return transactions;
}

// Get budget data from all sources
async function getAllBudgetData(userId, startDate, endDate) {
    const budgets = [];

    // Get WeeklyBudget data
    const weeklyBudgets = await WeeklyBudget.find({
        userId,
        weekStartDate: { $lte: endDate },
        weekEndDate: { $gte: startDate }
    }).populate('categories.categoryId');

    for (const weeklyBudget of weeklyBudgets) {
        for (const category of weeklyBudget.categories) {
            if (category.allocation > 0) {
                const spent = category.payments
                    .filter(p => p.status === 'paid')
                    .reduce((sum, p) => sum + p.amount, 0);

                budgets.push({
                    id: `${weeklyBudget._id}-${category.categoryId._id}`,
                    type: 'weekly',
                    categoryId: category.categoryId._id,
                    categoryName: category.categoryId.name,
                    categoryColor: category.categoryId.color,
                    categoryIcon: category.categoryId.icon,
                    budgeted: category.allocation,
                    spent: spent,
                    remaining: category.allocation - spent,
                    percentage: (spent / category.allocation) * 100,
                    startDate: weeklyBudget.weekStartDate,
                    endDate: weeklyBudget.weekEndDate,
                    status: spent > category.allocation ? 'exceeded' : 
                           spent > category.allocation * 0.8 ? 'warning' : 'good'
                });
            }
        }
    }

    // Get MainBudget data
    const mainBudgets = await MainBudget.find({
        userId,
        createdAt: { $lte: endDate }
    }).populate('categories.categoryId');

    for (const mainBudget of mainBudgets) {
        // Calculate spent from linked weekly budgets
        const linkedWeeklyBudgets = await WeeklyBudget.find({
            parentBudgetId: mainBudget._id
        }).populate('categories.categoryId');

        for (const category of mainBudget.categories) {
            let totalSpent = 0;

            // Sum up spending from all linked weekly budgets
            for (const weeklyBudget of linkedWeeklyBudgets) {
                const weekCategory = weeklyBudget.categories.find(
                    c => c.categoryId._id.toString() === category.categoryId._id.toString()
                );
                if (weekCategory) {
                    totalSpent += weekCategory.payments
                        .filter(p => p.status === 'paid')
                        .reduce((sum, p) => sum + p.amount, 0);
                }
            }

            const budgetAmount = category.monthlyAmount || 0;
            if (budgetAmount > 0) {
                budgets.push({
                    id: `${mainBudget._id}-${category.categoryId._id}`,
                    type: 'monthly',
                    categoryId: category.categoryId._id,
                    categoryName: category.categoryId.name,
                    categoryColor: category.categoryId.color,
                    categoryIcon: category.categoryId.icon,
                    budgeted: budgetAmount,
                    spent: totalSpent,
                    remaining: budgetAmount - totalSpent,
                    percentage: (totalSpent / budgetAmount) * 100,
                    startDate: mainBudget.period.startDate,
                    endDate: mainBudget.period.endDate,
                    status: totalSpent > budgetAmount ? 'exceeded' : 
                           totalSpent > budgetAmount * 0.8 ? 'warning' : 'good'
                });
            }
        }
    }

    return budgets;
}

// Aggregate financial data from all sources
async function aggregateAllFinancialData(userId, startDate, endDate, groupBy) {
    // Get regular transactions
    const transactions = await Transaction.find({
        userId,
        date: { $gte: startDate, $lte: endDate }
    }).populate('categoryId');

    // Get payments from weekly budgets and payment schedules
    const payments = await getPaymentsAsTransactions(userId, startDate, endDate);

    // Combine all data
    const allData = [...transactions, ...payments];

    // Group by the specified criteria
    const grouped = {};
    
    for (const item of allData) {
        const groupKey = typeof groupBy === 'function' ? groupBy(item) : item[groupBy] || 'all';
        
        if (!grouped[groupKey]) {
            grouped[groupKey] = {
                total: 0,
                count: 0,
                items: []
            };
        }
        
        grouped[groupKey].total += item.amount;
        grouped[groupKey].count += 1;
        grouped[groupKey].items.push(item);
    }

    // Calculate averages
    for (const key in grouped) {
        grouped[key].average = grouped[key].total / grouped[key].count;
    }

    return grouped;
}

module.exports = {
    getPaymentsAsTransactions,
    getAllBudgetData,
    aggregateAllFinancialData
};
