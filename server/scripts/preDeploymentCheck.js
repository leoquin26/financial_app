/**
 * Pre-Deployment Data Validation Script
 * Run this BEFORE deploying to production to identify potential issues
 * 
 * Usage: node scripts/preDeploymentCheck.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app';

async function runChecks() {
  console.log('🔍 Starting Pre-Deployment Data Validation...\n');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const WeeklyBudget = require('../models/WeeklyBudget');
    const PaymentSchedule = require('../models/PaymentSchedule');
    const Transaction = require('../models/Transaction');
    const Category = require('../models/Category');

    const issues = [];
    const warnings = [];

    // Check 1: Budget payments with invalid paymentScheduleId
    console.log('📋 Check 1: Validating budget payment links...');
    const budgets = await WeeklyBudget.find({});
    let orphanedLinks = 0;
    let paymentsWithoutLink = 0;
    let totalBudgetPayments = 0;

    for (const budget of budgets) {
      for (const category of budget.categories || []) {
        for (const payment of category.payments || []) {
          totalBudgetPayments++;
          
          if (payment.paymentScheduleId) {
            const schedule = await PaymentSchedule.findById(payment.paymentScheduleId);
            if (!schedule) {
              orphanedLinks++;
              warnings.push(`Budget ${budget._id}: Payment "${payment.name}" has orphaned paymentScheduleId ${payment.paymentScheduleId}`);
            }
          } else {
            paymentsWithoutLink++;
          }
        }
      }
    }
    
    console.log(`   Total budget payments: ${totalBudgetPayments}`);
    console.log(`   Payments without PaymentSchedule link: ${paymentsWithoutLink} (normal for old data)`);
    console.log(`   Orphaned links (PaymentSchedule deleted): ${orphanedLinks}`);
    if (orphanedLinks > 0) {
      warnings.push(`Found ${orphanedLinks} orphaned paymentScheduleId links - these won't sync but won't cause errors`);
    }
    console.log('');

    // Check 2: PaymentSchedule status vs WeeklyBudget status mismatches
    console.log('📋 Check 2: Checking status mismatches...');
    let statusMismatches = 0;
    const schedules = await PaymentSchedule.find({ weeklyBudgetId: { $exists: true, $ne: null } });
    
    for (const schedule of schedules) {
      const budget = await WeeklyBudget.findById(schedule.weeklyBudgetId);
      if (budget) {
        for (const category of budget.categories || []) {
          const budgetPayment = category.payments.find(p => 
            p.paymentScheduleId?.toString() === schedule._id.toString()
          );
          if (budgetPayment && budgetPayment.status !== schedule.status) {
            statusMismatches++;
            warnings.push(`Status mismatch: PaymentSchedule ${schedule._id} (${schedule.status}) vs Budget payment (${budgetPayment.status})`);
          }
        }
      }
    }
    
    console.log(`   PaymentSchedules linked to budgets: ${schedules.length}`);
    console.log(`   Status mismatches found: ${statusMismatches}`);
    if (statusMismatches > 0) {
      warnings.push(`Found ${statusMismatches} status mismatches - calendar may show different status than budget`);
    }
    console.log('');

    // Check 3: Duplicate transactions for same payment
    console.log('📋 Check 3: Checking for duplicate transactions...');
    const transactionsWithPaymentId = await Transaction.find({ 
      paymentScheduleId: { $exists: true, $ne: null } 
    });
    
    const paymentIdCounts = {};
    transactionsWithPaymentId.forEach(t => {
      const id = t.paymentScheduleId.toString();
      paymentIdCounts[id] = (paymentIdCounts[id] || 0) + 1;
    });
    
    const duplicates = Object.entries(paymentIdCounts).filter(([_, count]) => count > 1);
    console.log(`   Transactions linked to payments: ${transactionsWithPaymentId.length}`);
    console.log(`   Duplicate transaction entries: ${duplicates.length}`);
    if (duplicates.length > 0) {
      duplicates.forEach(([id, count]) => {
        issues.push(`PaymentSchedule ${id} has ${count} transactions (should be 1)`);
      });
    }
    console.log('');

    // Check 4: Quick Payment category exists
    console.log('📋 Check 4: Checking Quick Payment category...');
    const quickPaymentCategory = await Category.findOne({ 
      isSystem: true, 
      name: 'Quick Payment' 
    });
    
    if (quickPaymentCategory) {
      console.log(`   ✅ Quick Payment category exists: ${quickPaymentCategory._id}`);
    } else {
      issues.push('Quick Payment system category not found - will be created on first use');
      console.log('   ⚠️ Quick Payment category not found');
    }
    console.log('');

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    
    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n✅ No issues found! Safe to deploy.\n');
    } else {
      if (issues.length > 0) {
        console.log(`\n❌ ISSUES (${issues.length}) - Should fix before deploy:`);
        issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
      }
      
      if (warnings.length > 0) {
        console.log(`\n⚠️ WARNINGS (${warnings.length}) - Won't cause errors but may need attention:`);
        warnings.forEach((warning, i) => console.log(`   ${i + 1}. ${warning}`));
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    
    // Recommendations
    console.log('\n📝 RECOMMENDATIONS:');
    
    if (statusMismatches > 0) {
      console.log('   1. Run the status sync script to fix mismatches:');
      console.log('      node scripts/syncPaymentStatuses.js');
    }
    
    if (duplicates.length > 0) {
      console.log('   2. Review and remove duplicate transactions manually');
    }
    
    if (orphanedLinks > 0) {
      console.log('   3. Orphaned links are harmless but can be cleaned up');
    }
    
    console.log('\n');

  } catch (error) {
    console.error('❌ Error during validation:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

runChecks();

