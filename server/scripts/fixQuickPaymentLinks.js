const mongoose = require('mongoose');
require('dotenv').config();

async function fixQuickPaymentLinks() {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app');
        console.log('Connected to database');
        
        const WeeklyBudget = require('../models/WeeklyBudget');
        const Transaction = require('../models/Transaction');
        const Category = require('../models/Category');
        
        // Find Quick Payment category
        const quickPaymentCategory = await Category.findOne({
            name: 'Quick Payment',
            isSystem: true
        });
        
        if (!quickPaymentCategory) {
            console.log('Quick Payment category not found');
            return;
        }
        
        console.log('Quick Payment category:', quickPaymentCategory._id);
        
        // Find all weekly budgets
        const budgets = await WeeklyBudget.find({});
        console.log(`Found ${budgets.length} budgets to check`);
        
        let fixedCount = 0;
        
        for (const budget of budgets) {
            let budgetModified = false;
            
            // Check each category in the budget
            for (const category of budget.categories) {
                // Only check Quick Payment category
                if (category.categoryId.toString() === quickPaymentCategory._id.toString()) {
                    console.log(`Checking Quick Payment category in budget ${budget._id}`);
                    
                    for (const payment of category.payments) {
                        // If payment doesn't have a transactionId, try to find matching transaction
                        if (!payment.transactionId && payment.status === 'paid') {
                            console.log(`Payment "${payment.name}" missing transactionId, searching...`);
                            
                            // Find matching transaction
                            const transaction = await Transaction.findOne({
                                userId: budget.userId,
                                categoryId: quickPaymentCategory._id,
                                amount: payment.amount,
                                date: {
                                    $gte: new Date(payment.scheduledDate.getTime() - 24*60*60*1000),
                                    $lte: new Date(payment.scheduledDate.getTime() + 24*60*60*1000)
                                }
                            });
                            
                            if (transaction) {
                                console.log(`Found matching transaction ${transaction._id} for payment "${payment.name}"`);
                                payment.transactionId = transaction._id;
                                budgetModified = true;
                                fixedCount++;
                            } else {
                                console.log(`No matching transaction found for payment "${payment.name}"`);
                            }
                        }
                    }
                }
            }
            
            if (budgetModified) {
                budget.markModified('categories');
                await budget.save();
                console.log(`Updated budget ${budget._id}`);
            }
        }
        
        console.log(`\n✓ Fixed ${fixedCount} payment links`);
        
        // Now verify no duplicates
        console.log('\nVerifying Quick Payment transactions...');
        const quickPayments = await Transaction.find({
            categoryId: quickPaymentCategory._id
        }).sort('-createdAt').limit(10);
        
        console.log(`Found ${quickPayments.length} recent Quick Payment transactions`);
        
        for (const qp of quickPayments) {
            // Check if this transaction is properly linked in a budget
            const budgetWithPayment = await WeeklyBudget.findOne({
                userId: qp.userId,
                'categories.payments.transactionId': qp._id
            });
            
            if (budgetWithPayment) {
                console.log(`✓ Transaction ${qp._id} is properly linked to budget`);
            } else {
                console.log(`✗ Transaction ${qp._id} is NOT linked to any budget`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

fixQuickPaymentLinks();
