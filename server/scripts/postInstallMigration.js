/**
 * Post-Install Migration Script
 * Runs automatically after npm install on Railway
 * 
 * This script is SAFE to run multiple times (idempotent)
 * It only fixes issues, never creates problems
 */

// Only run in production
if (process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT) {
  console.log('⏭️ Skipping post-install migration (not in production)');
  process.exit(0);
}

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.log('⏭️ Skipping migration: MONGODB_URI not set');
  process.exit(0);
}

async function runMigrations() {
  console.log('🚀 Running post-install migrations...\n');
  
  let hasErrors = false;
  
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ Connected to MongoDB\n');

    // Import models
    const WeeklyBudget = require('../models/WeeklyBudget');
    const PaymentSchedule = require('../models/PaymentSchedule');
    const Transaction = require('../models/Transaction');
    const Category = require('../models/Category');

    // Migration 1: Ensure Quick Payment category exists
    console.log('📋 Migration 1: Ensuring Quick Payment category...');
    try {
      let quickPaymentCategory = await Category.findOne({ 
        isSystem: true, 
        name: 'Quick Payment' 
      });
      
      if (!quickPaymentCategory) {
        quickPaymentCategory = await Category.create({
          name: 'Quick Payment',
          type: 'expense',
          color: '#7C3AED',
          icon: '⚡',
          isDefault: false,
          isSystem: true,
          description: 'Automatic category for quick payments'
        });
        console.log('   ✅ Created Quick Payment category');
      } else {
        console.log('   ✅ Quick Payment category already exists');
      }
    } catch (error) {
      console.error('   ❌ Error with Quick Payment category:', error.message);
      hasErrors = true;
    }

    // Migration 2: Sync payment statuses (only fix mismatches)
    console.log('\n📋 Migration 2: Syncing payment statuses...');
    try {
      const schedules = await PaymentSchedule.find({ 
        weeklyBudgetId: { $exists: true, $ne: null } 
      });

      let synced = 0;
      for (const schedule of schedules) {
        const budget = await WeeklyBudget.findById(schedule.weeklyBudgetId);
        if (!budget) continue;

        for (const category of budget.categories || []) {
          const budgetPayment = category.payments.find(p => 
            p.paymentScheduleId?.toString() === schedule._id.toString()
          );
          
          if (budgetPayment && budgetPayment.status !== schedule.status) {
            // Sync to budget status (what user sees)
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
      }
      console.log(`   ✅ Synced ${synced} payment statuses`);
    } catch (error) {
      console.error('   ❌ Error syncing statuses:', error.message);
      hasErrors = true;
    }

    // Migration 3: Clean up duplicate transactions
    console.log('\n📋 Migration 3: Cleaning up duplicate transactions...');
    try {
      const transactionsWithPaymentId = await Transaction.find({ 
        paymentScheduleId: { $exists: true, $ne: null } 
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
          // Keep the first (most recent), delete the rest
          const toDelete = transactions.slice(1);
          for (const transaction of toDelete) {
            await Transaction.findByIdAndDelete(transaction._id);
            deleted++;
          }
        }
      }
      console.log(`   ✅ Removed ${deleted} duplicate transactions`);
    } catch (error) {
      console.error('   ❌ Error cleaning duplicates:', error.message);
      hasErrors = true;
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    if (hasErrors) {
      console.log('⚠️ Migrations completed with some errors (non-fatal)');
    } else {
      console.log('✅ All migrations completed successfully!');
    }
    console.log('═══════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    // Don't exit with error code - we don't want to fail the deployment
  } finally {
    try {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

runMigrations().then(() => {
  process.exit(0);
}).catch(() => {
  // Exit successfully even on error - don't block deployment
  process.exit(0);
});

