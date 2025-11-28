/**
 * Startup Migrations
 * Runs automatically when the server starts
 * All migrations are idempotent (safe to run multiple times)
 */

const mongoose = require('mongoose');

async function runStartupMigrations() {
  console.log('🔄 Running startup migrations...');
  
  try {
    const PaymentSchedule = require('../models/PaymentSchedule');
    const WeeklyBudget = require('../models/WeeklyBudget');
    const Transaction = require('../models/Transaction');

    // Migration 1: Sync any mismatched payment statuses
    const schedules = await PaymentSchedule.find({ 
      weeklyBudgetId: { $exists: true, $ne: null } 
    }).limit(100); // Limit to avoid long startup times

    let synced = 0;
    for (const schedule of schedules) {
      try {
        const budget = await WeeklyBudget.findById(schedule.weeklyBudgetId);
        if (!budget) continue;

        for (const category of budget.categories || []) {
          const budgetPayment = category.payments.find(p => 
            p.paymentScheduleId?.toString() === schedule._id.toString()
          );
          
          if (budgetPayment && budgetPayment.status !== schedule.status) {
            // Sync PaymentSchedule to match budget status
            schedule.status = budgetPayment.status;
            if (budgetPayment.status === 'paid') {
              schedule.paidDate = budgetPayment.paidDate;
              schedule.paidBy = budgetPayment.paidBy;
            } else {
              schedule.paidDate = undefined;
              schedule.paidBy = undefined;
            }
            await schedule.save();
            synced++;
          }
        }
      } catch (err) {
        // Continue with next schedule
      }
    }
    
    if (synced > 0) {
      console.log(`   ✅ Synced ${synced} payment statuses`);
    }

    // Migration 2: Clean up any duplicate transactions (limit to recent)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 30); // Last 30 days
    
    const transactionsWithPaymentId = await Transaction.find({ 
      paymentScheduleId: { $exists: true, $ne: null },
      createdAt: { $gte: recentDate }
    }).sort({ createdAt: -1 });

    const groupedByPaymentId = {};
    transactionsWithPaymentId.forEach(t => {
      const id = t.paymentScheduleId.toString();
      if (!groupedByPaymentId[id]) {
        groupedByPaymentId[id] = [];
      }
      groupedByPaymentId[id].push(t);
    });

    let deleted = 0;
    for (const [paymentScheduleId, transactions] of Object.entries(groupedByPaymentId)) {
      if (transactions.length > 1) {
        const toDelete = transactions.slice(1);
        for (const transaction of toDelete) {
          await Transaction.findByIdAndDelete(transaction._id);
          deleted++;
        }
      }
    }
    
    if (deleted > 0) {
      console.log(`   ✅ Removed ${deleted} duplicate transactions`);
    }

    console.log('✅ Startup migrations complete');
    
  } catch (error) {
    console.error('⚠️ Startup migration error (non-fatal):', error.message);
    // Don't throw - we don't want to prevent server from starting
  }
}

module.exports = runStartupMigrations;

