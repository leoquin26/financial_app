const cron = require('node-cron');
const User = require('../models/User');
const PaymentSchedule = require('../models/PaymentSchedule');
const WeeklyBudget = require('../models/WeeklyBudget');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { sendEmail } = require('../utils/emailService');
const { getIo } = require('../utils/socketManager');
const { startOfWeek, endOfWeek, subDays, format, differenceInDays, isAfter, isBefore, startOfDay, endOfDay } = require('date-fns');
const { es } = require('date-fns/locale');

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

// Create and optionally send notification
async function createNotification(userId, type, title, message, options = {}) {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found for notification:', userId);
            return null;
        }

        // Create notification
        const notification = new Notification({
            userId,
            type,
            title,
            message,
            data: options.data || {},
            priority: options.priority || 'normal',
            actionUrl: options.actionUrl,
            relatedEntity: options.relatedEntity,
            expiresAt: options.expiresAt
        });

        await notification.save();

        // Emit real-time notification
        emitNotification(userId, notification);

        // Check if email should be sent
        const shouldSendEmail = user.notifications?.email && options.sendEmail !== false;
        
        // Map notification type to email preference
        const emailPreferenceMap = {
            'budget_alert': 'budgetAlerts',
            'budget_exceeded': 'budgetAlerts',
            'transaction': 'transactionAlerts',
            'payment_reminder': 'budgetAlerts',
            'payment_overdue': 'budgetAlerts',
            'weekly_report': 'weeklyReport',
            'monthly_report': 'monthlyReport'
        };

        const preferenceKey = emailPreferenceMap[type];
        const hasPreference = !preferenceKey || user.notifications?.[preferenceKey] !== false;

        if (shouldSendEmail && hasPreference && options.emailTemplate && options.emailData) {
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

// Check for upcoming payment reminders
async function checkPaymentReminders() {
    console.log('Running payment reminder check...');
    
    try {
        const today = startOfDay(new Date());
        
        // Find all pending payments with reminders enabled
        const payments = await PaymentSchedule.find({
            status: 'pending',
            'reminder.enabled': true,
            dueDate: { $gte: today }
        }).populate('categoryId').populate('userId');

        for (const payment of payments) {
            const user = payment.userId;
            if (!user) continue;

            const dueDate = new Date(payment.dueDate);
            const daysBefore = payment.reminder?.daysBefore || 1;
            const reminderDate = subDays(dueDate, daysBefore);
            
            // Check if today is the reminder date
            if (format(today, 'yyyy-MM-dd') === format(reminderDate, 'yyyy-MM-dd')) {
                // Check if we already sent a reminder for this payment today
                const existingReminder = await Notification.findOne({
                    userId: user._id,
                    type: 'payment_reminder',
                    'relatedEntity.type': 'payment',
                    'relatedEntity.id': payment._id,
                    createdAt: { $gte: today }
                });

                if (!existingReminder) {
                    const daysText = daysBefore === 0 ? 'hoy' : 
                                    daysBefore === 1 ? 'mañana' : 
                                    `en ${daysBefore} días`;

                    // Determine the best action URL based on available data
                    let actionUrl = '/payments'; // Default to payments page
                    if (payment.weeklyBudgetId) {
                        actionUrl = `/weekly-budget/${payment.weeklyBudgetId}`;
                    }

                    await createNotification(
                        user._id,
                        'payment_reminder',
                        `Recordatorio: ${payment.name}`,
                        `Tu pago de ${getCurrencySymbol(user.currency)} ${payment.amount.toFixed(2)} vence ${daysText}`,
                        {
                            priority: daysBefore <= 1 ? 'high' : 'normal',
                            actionUrl,
                            relatedEntity: { type: 'payment', id: payment._id },
                            data: {
                                paymentId: payment._id,
                                paymentName: payment.name,
                                amount: payment.amount,
                                dueDate: format(dueDate, 'dd/MM/yyyy'),
                                weeklyBudgetId: payment.weeklyBudgetId
                            },
                            sendEmail: true,
                            emailTemplate: 'paymentReminder',
                            emailData: {
                                paymentName: payment.name,
                                amount: payment.amount,
                                dueDate: format(dueDate, 'dd/MM/yyyy'),
                                daysText,
                                categoryName: payment.categoryId?.name,
                                notes: payment.notes
                            }
                        }
                    );
                    
                    console.log(`Sent payment reminder for: ${payment.name} to user ${user._id}`);
                }
            }
        }
    } catch (error) {
        console.error('Error checking payment reminders:', error);
    }
}

// Check for overdue payments
async function checkOverduePayments() {
    console.log('Running overdue payment check...');
    
    try {
        const today = startOfDay(new Date());
        
        // Find all pending payments that are overdue
        const overduePayments = await PaymentSchedule.find({
            status: 'pending',
            dueDate: { $lt: today }
        }).populate('categoryId').populate('userId');

        for (const payment of overduePayments) {
            const user = payment.userId;
            if (!user) continue;

            // Update payment status to overdue
            payment.status = 'overdue';
            await payment.save();

            const dueDate = new Date(payment.dueDate);
            const daysOverdue = differenceInDays(today, dueDate);

            // Check if we already sent an overdue notification today
            const existingNotification = await Notification.findOne({
                userId: user._id,
                type: 'payment_overdue',
                'relatedEntity.type': 'payment',
                'relatedEntity.id': payment._id,
                createdAt: { $gte: today }
            });

            if (!existingNotification) {
                // Determine the best action URL based on available data
                let actionUrl = '/payments'; // Default to payments page
                if (payment.weeklyBudgetId) {
                    actionUrl = `/weekly-budget/${payment.weeklyBudgetId}`;
                }

                await createNotification(
                    user._id,
                    'payment_overdue',
                    `¡Pago vencido! ${payment.name}`,
                    `Tu pago de ${getCurrencySymbol(user.currency)} ${payment.amount.toFixed(2)} está vencido hace ${daysOverdue} día${daysOverdue > 1 ? 's' : ''}`,
                    {
                        priority: 'urgent',
                        actionUrl,
                        relatedEntity: { type: 'payment', id: payment._id },
                        data: {
                            paymentId: payment._id,
                            paymentName: payment.name,
                            amount: payment.amount,
                            dueDate: format(dueDate, 'dd/MM/yyyy'),
                            daysOverdue,
                            weeklyBudgetId: payment.weeklyBudgetId
                        },
                        sendEmail: true,
                        emailTemplate: 'paymentOverdue',
                        emailData: {
                            paymentName: payment.name,
                            amount: payment.amount,
                            dueDate: format(dueDate, 'dd/MM/yyyy'),
                            daysOverdue,
                            categoryName: payment.categoryId?.name
                        }
                    }
                );
                
                console.log(`Sent overdue notification for: ${payment.name} to user ${user._id}`);
            }
        }
    } catch (error) {
        console.error('Error checking overdue payments:', error);
    }
}

// Check budget alerts (when spending approaches or exceeds budget)
async function checkBudgetAlerts() {
    console.log('Running budget alert check...');
    
    try {
        const today = new Date();
        const weekStart = startOfWeek(today, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

        // Find all active weekly budgets for this week
        const budgets = await WeeklyBudget.find({
            weekStartDate: { $lte: today },
            weekEndDate: { $gte: today }
        }).populate('userId').populate('categories.categoryId');

        for (const budget of budgets) {
            const user = budget.userId;
            if (!user || !user.notifications?.budgetAlerts) continue;

            for (const category of budget.categories) {
                if (!category.categoryId || category.allocation <= 0) continue;

                // Calculate spent amount
                const spent = category.payments
                    .filter(p => p.status === 'paid')
                    .reduce((sum, p) => sum + p.amount, 0);

                const percentage = (spent / category.allocation) * 100;
                const alertThresholds = [80, 100]; // Alert at 80% and 100%

                for (const threshold of alertThresholds) {
                    if (percentage >= threshold) {
                        // Check if we already sent this alert today
                        const alertType = threshold >= 100 ? 'budget_exceeded' : 'budget_alert';
                        const existingAlert = await Notification.findOne({
                            userId: user._id,
                            type: alertType,
                            'data.categoryId': category.categoryId._id.toString(),
                            'data.threshold': threshold,
                            createdAt: { $gte: startOfDay(today) }
                        });

                        if (!existingAlert) {
                            const title = threshold >= 100 
                                ? `¡Presupuesto excedido! ${category.categoryId.name}`
                                : `Alerta de presupuesto: ${category.categoryId.name}`;
                            
                            const message = threshold >= 100
                                ? `Has gastado ${percentage.toFixed(0)}% de tu presupuesto en ${category.categoryId.name}`
                                : `Has usado el ${percentage.toFixed(0)}% de tu presupuesto en ${category.categoryId.name}`;

                            // Link directly to the weekly budget
                            const actionUrl = `/weekly-budget/${budget._id}`;

                            await createNotification(
                                user._id,
                                alertType,
                                title,
                                message,
                                {
                                    priority: threshold >= 100 ? 'high' : 'normal',
                                    actionUrl,
                                    relatedEntity: { type: 'budget', id: budget._id },
                                    data: {
                                        budgetId: budget._id,
                                        categoryId: category.categoryId._id.toString(),
                                        categoryName: category.categoryId.name,
                                        spent,
                                        budget: category.allocation,
                                        percentage,
                                        threshold
                                    },
                                    sendEmail: true,
                                    emailTemplate: 'budgetAlert',
                                    emailData: {
                                        categoryName: category.categoryId.name,
                                        spent,
                                        budget: category.allocation,
                                        percentage
                                    }
                                }
                            );
                            
                            console.log(`Sent budget alert for: ${category.categoryId.name} (${percentage.toFixed(0)}%) to user ${user._id}`);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error checking budget alerts:', error);
    }
}

// Generate and send weekly reports
async function sendWeeklyReports() {
    console.log('Generating weekly reports...');
    
    try {
        const today = new Date();
        const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });

        // Find users who want weekly reports
        const users = await User.find({
            'notifications.weeklyReport': true
        });

        for (const user of users) {
            // Get transactions for last week
            const transactions = await Transaction.find({
                userId: user._id,
                date: {
                    $gte: lastWeekStart,
                    $lte: lastWeekEnd
                }
            }).populate('categoryId');

            const income = transactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);

            const expenses = transactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);

            const balance = income - expenses;
            const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : 0;

            // Get top expense categories
            const categoryExpenses = {};
            transactions
                .filter(t => t.type === 'expense' && t.categoryId)
                .forEach(t => {
                    const catName = t.categoryId.name;
                    if (!categoryExpenses[catName]) {
                        categoryExpenses[catName] = {
                            name: catName,
                            amount: 0,
                            color: t.categoryId.color || '#666',
                            icon: t.categoryId.icon || '📦'
                        };
                    }
                    categoryExpenses[catName].amount += t.amount;
                });

            const topCategories = Object.values(categoryExpenses)
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 5);

            await createNotification(
                user._id,
                'weekly_report',
                'Tu Resumen Semanal',
                `Ingresos: ${getCurrencySymbol(user.currency)} ${income.toFixed(2)} | Gastos: ${getCurrencySymbol(user.currency)} ${expenses.toFixed(2)}`,
                {
                    priority: 'low',
                    actionUrl: '/analytics',
                    data: {
                        weekStart: format(lastWeekStart, 'dd/MM/yyyy'),
                        weekEnd: format(lastWeekEnd, 'dd/MM/yyyy'),
                        income,
                        expenses,
                        balance,
                        savingsRate,
                        topCategories
                    },
                    sendEmail: true,
                    emailTemplate: 'weeklyReport',
                    emailData: {
                        weekStart: format(lastWeekStart, 'dd MMM', { locale: es }),
                        weekEnd: format(lastWeekEnd, 'dd MMM', { locale: es }),
                        income,
                        expenses,
                        balance,
                        savingsRate,
                        topCategories
                    }
                }
            );
            
            console.log(`Sent weekly report to user ${user._id}`);
        }
    } catch (error) {
        console.error('Error sending weekly reports:', error);
    }
}

// Initialize all scheduled tasks
function initializeScheduler() {
    console.log('Initializing notification scheduler...');

    // Check payment reminders every day at 8:00 AM
    cron.schedule('0 8 * * *', () => {
        checkPaymentReminders();
    }, {
        timezone: 'America/Lima'
    });

    // Check overdue payments every day at 9:00 AM
    cron.schedule('0 9 * * *', () => {
        checkOverduePayments();
    }, {
        timezone: 'America/Lima'
    });

    // Check budget alerts every 6 hours
    cron.schedule('0 */6 * * *', () => {
        checkBudgetAlerts();
    }, {
        timezone: 'America/Lima'
    });

    // Send weekly reports every Monday at 8:00 AM
    cron.schedule('0 8 * * 1', () => {
        sendWeeklyReports();
    }, {
        timezone: 'America/Lima'
    });

    console.log('Notification scheduler initialized with the following schedules:');
    console.log('- Payment reminders: Daily at 8:00 AM');
    console.log('- Overdue payments: Daily at 9:00 AM');
    console.log('- Budget alerts: Every 6 hours');
    console.log('- Weekly reports: Mondays at 8:00 AM');

    // Run initial checks on startup (after a delay to let DB connect)
    setTimeout(async () => {
        console.log('Running initial notification checks...');
        await checkPaymentReminders();
        await checkOverduePayments();
        await checkBudgetAlerts();
    }, 10000);
}

// Manual trigger functions for testing
async function triggerPaymentReminders() {
    await checkPaymentReminders();
}

async function triggerOverdueCheck() {
    await checkOverduePayments();
}

async function triggerBudgetAlerts() {
    await checkBudgetAlerts();
}

async function triggerWeeklyReport(userId) {
    if (userId) {
        // Send to specific user
        const user = await User.findById(userId);
        if (user) {
            // Generate report for this user
            const today = new Date();
            const lastWeekStart = startOfWeek(subDays(today, 7), { weekStartsOn: 1 });
            const lastWeekEnd = endOfWeek(subDays(today, 7), { weekStartsOn: 1 });
            
            const transactions = await Transaction.find({
                userId: user._id,
                date: { $gte: lastWeekStart, $lte: lastWeekEnd }
            }).populate('categoryId');

            const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
            const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

            await createNotification(
                user._id,
                'weekly_report',
                'Tu Resumen Semanal (Manual)',
                `Ingresos: ${getCurrencySymbol(user.currency)} ${income.toFixed(2)} | Gastos: ${getCurrencySymbol(user.currency)} ${expenses.toFixed(2)}`,
                {
                    priority: 'low',
                    actionUrl: '/analytics',
                    data: { income, expenses, balance: income - expenses }
                }
            );
        }
    } else {
        await sendWeeklyReports();
    }
}

module.exports = {
    initializeScheduler,
    createNotification,
    triggerPaymentReminders,
    triggerOverdueCheck,
    triggerBudgetAlerts,
    triggerWeeklyReport,
    checkPaymentReminders,
    checkOverduePayments,
    checkBudgetAlerts
};

