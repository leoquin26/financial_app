/**
 * Sync Payment Statuses Script
 * Syncs status between PaymentSchedule and WeeklyBudget collections
 * 
 * Usage: node scripts/syncPaymentStatuses.js [--dry-run]
 * 
 * --dry-run: Only show what would be changed without making changes
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app';
const isDryRun = process.argv.includes('--dry-run');

async function syncStatuses() {
  console.log(`🔄 Starting Payment Status Sync ${isDryRun ? '(DRY RUN)' : ''}...\n`);
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const WeeklyBudget = require('../models/WeeklyBudget');
    const PaymentSchedule = require('../models/PaymentSchedule');

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    // Get all PaymentSchedules that are linked to a WeeklyBudget
    const schedules = await PaymentSchedule.find({ 
      weeklyBudgetId: { $exists: true, $ne: null } 
    });

    console.log(`Found ${schedules.length} PaymentSchedules linked to WeeklyBudgets\n`);

    for (const schedule of schedules) {
      try {
        const budget = await WeeklyBudget.findById(schedule.weeklyBudgetId);
        
        if (!budget) {
          console.log(`⚠️ Budget ${schedule.weeklyBudgetId} not found for schedule ${schedule._id}`);
          skipped++;
          continue;
        }

        // Find the corresponding payment in the budget
        let budgetPayment = null;
        let categoryIndex = -1;
        let paymentIndex = -1;

        for (let ci = 0; ci < budget.categories.length; ci++) {
          for (let pi = 0; pi < budget.categories[ci].payments.length; pi++) {
            const payment = budget.categories[ci].payments[pi];
            if (payment.paymentScheduleId?.toString() === schedule._id.toString()) {
              budgetPayment = payment;
              categoryIndex = ci;
              paymentIndex = pi;
              break;
            }
          }
          if (budgetPayment) break;
        }

        if (!budgetPayment) {
          console.log(`⚠️ Payment not found in budget for schedule ${schedule._id} (${schedule.name})`);
          skipped++;
          continue;
        }

        // Check if statuses match
        if (budgetPayment.status === schedule.status) {
          // Already in sync
          continue;
        }

        // Determine which status to use (prefer the most recent update)
        // If budget payment has paidDate, use budget status; otherwise use schedule status
        const budgetHasPaidInfo = budgetPayment.paidDate || budgetPayment.paidBy;
        const scheduleHasPaidInfo = schedule.paidDate || schedule.paidBy;

        let targetStatus;
        let source;

        if (budgetPayment.status === 'paid' && budgetHasPaidInfo) {
          targetStatus = 'paid';
          source = 'budget';
        } else if (schedule.status === 'paid' && scheduleHasPaidInfo) {
          targetStatus = 'paid';
          source = 'schedule';
        } else {
          // Default to the budget status as it's what the user sees
          targetStatus = budgetPayment.status;
          source = 'budget';
        }

        console.log(`\n📝 Mismatch found:`);
        console.log(`   Payment: "${schedule.name}"`);
        console.log(`   PaymentSchedule status: ${schedule.status}`);
        console.log(`   WeeklyBudget status: ${budgetPayment.status}`);
        console.log(`   → Will sync to: ${targetStatus} (from ${source})`);

        if (!isDryRun) {
          // Update PaymentSchedule
          if (schedule.status !== targetStatus) {
            schedule.status = targetStatus;
            if (targetStatus === 'paid' && budgetPayment.paidDate) {
              schedule.paidDate = budgetPayment.paidDate;
              schedule.paidBy = budgetPayment.paidBy;
            } else if (targetStatus !== 'paid') {
              schedule.paidDate = undefined;
              schedule.paidBy = undefined;
            }
            await schedule.save();
            console.log(`   ✅ Updated PaymentSchedule`);
          }

          // Update Budget payment
          if (budgetPayment.status !== targetStatus) {
            budget.categories[categoryIndex].payments[paymentIndex].status = targetStatus;
            if (targetStatus === 'paid' && schedule.paidDate) {
              budget.categories[categoryIndex].payments[paymentIndex].paidDate = schedule.paidDate;
              budget.categories[categoryIndex].payments[paymentIndex].paidBy = schedule.paidBy;
            } else if (targetStatus !== 'paid') {
              budget.categories[categoryIndex].payments[paymentIndex].paidDate = undefined;
              budget.categories[categoryIndex].payments[paymentIndex].paidBy = undefined;
            }
            budget.markModified('categories');
            await budget.save();
            console.log(`   ✅ Updated WeeklyBudget`);
          }
        }

        synced++;

      } catch (error) {
        console.error(`❌ Error processing schedule ${schedule._id}:`, error.message);
        errors++;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Total schedules checked: ${schedules.length}`);
    console.log(`   Synced: ${synced}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);
    
    if (isDryRun && synced > 0) {
      console.log(`\n⚠️ This was a DRY RUN. Run without --dry-run to apply changes.`);
    }
    
    console.log('');

  } catch (error) {
    console.error('❌ Error during sync:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

syncStatuses();

