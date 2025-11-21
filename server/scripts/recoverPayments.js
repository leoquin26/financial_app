const mongoose = require('mongoose');
const connectDB = require('../config/db');
const WeeklyBudget = require('../models/WeeklyBudget');
const Transaction = require('../models/Transaction');
const PaymentSchedule = require('../models/PaymentSchedule');

async function recoverPayments() {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🔍 Searching for Nov 19 payments to recover...\n');
    
    // Target date
    const targetDate = new Date('2025-11-19');
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Find all transactions from Nov 19
    const transactions = await Transaction.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      type: 'expense'
    }).populate('categoryId');
    
    console.log(`Found ${transactions.length} transactions from Nov 19\n`);
    
    // Find all payment schedules from Nov 19
    const paymentSchedules = await PaymentSchedule.find({
      $or: [
        { dueDate: { $gte: startOfDay, $lte: endOfDay } },
        { paidDate: { $gte: startOfDay, $lte: endOfDay } }
      ]
    }).populate('categoryId');
    
    console.log(`Found ${paymentSchedules.length} payment schedules from Nov 19\n`);
    
    // Find the correct week for Nov 19 (Week 4: Nov 18-24)
    const correctWeek = await WeeklyBudget.findOne({
      weekStartDate: { $lte: targetDate },
      weekEndDate: { $gte: targetDate }
    }).populate('categories.categoryId');
    
    if (!correctWeek) {
      console.log('❌ No weekly budget found for Nov 19!');
      console.log('You may need to create Week 4 (Nov 18-24) first.\n');
      
      // Show what payments need to be restored
      console.log('Payments that need to be restored:');
      transactions.forEach(t => {
        console.log(`  - ${t.description || t.categoryId?.name}: $${t.amount}`);
      });
      paymentSchedules.forEach(p => {
        console.log(`  - ${p.name}: $${p.amount} (${p.status})`);
      });
      
      return;
    }
    
    console.log(`✅ Found correct week: ${correctWeek.weekStartDate.toDateString()} - ${correctWeek.weekEndDate.toDateString()}\n`);
    
    let paymentsAdded = 0;
    
    // Process transactions
    for (const transaction of transactions) {
      const categoryId = transaction.categoryId._id.toString();
      
      // Check if transaction is already in the budget
      let found = false;
      for (const cat of correctWeek.categories) {
        if (cat.payments.some(p => p.transactionId?.toString() === transaction._id.toString())) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Find or create category in budget
        let budgetCategory = correctWeek.categories.find(
          cat => cat.categoryId._id.toString() === categoryId
        );
        
        if (!budgetCategory) {
          budgetCategory = {
            categoryId: transaction.categoryId._id,
            allocation: 0,
            payments: []
          };
          correctWeek.categories.push(budgetCategory);
        }
        
        // Add transaction as payment
        const payment = {
          _id: new mongoose.Types.ObjectId(),
          name: transaction.description || `${transaction.categoryId.name} expense`,
          amount: transaction.amount,
          scheduledDate: transaction.date,
          status: 'paid',
          paidDate: transaction.date,
          paidBy: transaction.userId,
          transactionId: transaction._id,
          notes: `Recovered from transaction: ${transaction.paymentMethod || 'N/A'}`
        };
        
        budgetCategory.payments.push(payment);
        
        // Update allocation if needed
        const totalPayments = budgetCategory.payments.reduce((sum, p) => sum + p.amount, 0);
        if (budgetCategory.allocation < totalPayments) {
          budgetCategory.allocation = totalPayments;
        }
        
        paymentsAdded++;
        console.log(`✅ Restored transaction: ${payment.name} - $${payment.amount}`);
      } else {
        console.log(`⏭️  Transaction already in budget: ${transaction.description}`);
      }
    }
    
    // Process payment schedules
    for (const schedule of paymentSchedules) {
      const categoryId = schedule.categoryId._id.toString();
      
      // Check if payment is already in the budget
      let found = false;
      for (const cat of correctWeek.categories) {
        if (cat.payments.some(p => p.paymentScheduleId?.toString() === schedule._id.toString())) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        // Find or create category in budget
        let budgetCategory = correctWeek.categories.find(
          cat => cat.categoryId._id.toString() === categoryId
        );
        
        if (!budgetCategory) {
          budgetCategory = {
            categoryId: schedule.categoryId._id,
            allocation: 0,
            payments: []
          };
          correctWeek.categories.push(budgetCategory);
        }
        
        // Add payment
        const payment = {
          _id: new mongoose.Types.ObjectId(),
          name: schedule.name,
          amount: schedule.amount,
          scheduledDate: schedule.dueDate,
          status: schedule.status,
          paidDate: schedule.paidDate,
          paidBy: schedule.paidBy,
          paymentScheduleId: schedule._id,
          notes: schedule.notes || 'Recovered payment'
        };
        
        budgetCategory.payments.push(payment);
        
        // Update allocation if needed
        const totalPayments = budgetCategory.payments.reduce((sum, p) => sum + p.amount, 0);
        if (budgetCategory.allocation < totalPayments) {
          budgetCategory.allocation = totalPayments;
        }
        
        paymentsAdded++;
        console.log(`✅ Restored payment: ${payment.name} - $${payment.amount}`);
      } else {
        console.log(`⏭️  Payment already in budget: ${schedule.name}`);
      }
    }
    
    if (paymentsAdded > 0) {
      await correctWeek.save();
      console.log(`\n✅ Successfully restored ${paymentsAdded} payments to Week 4!`);
      console.log(`Week 4 budget ID: ${correctWeek._id}`);
    } else {
      console.log('\nℹ️  No payments needed to be restored - they may already be in the correct week.');
    }
    
    // Also check Week 3 to see what's there
    console.log('\n📊 Checking Week 3 (Nov 9-16) for reference...');
    const week3Start = new Date('2025-11-09');
    week3Start.setHours(0, 0, 0, 0);
    const week3End = new Date('2025-11-16');
    week3End.setHours(23, 59, 59, 999);
    
    const week3 = await WeeklyBudget.findOne({
      weekStartDate: { $gte: week3Start, $lte: week3Start },
      weekEndDate: { $gte: week3End, $lte: week3End }
    }).populate('categories.categoryId');
    
    if (week3) {
      console.log(`Week 3 budget found: ${week3._id}`);
      let totalPayments = 0;
      week3.categories.forEach(cat => {
        totalPayments += cat.payments.length;
      });
      console.log(`Week 3 contains ${totalPayments} payments total`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error recovering payments:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  recoverPayments();
}

module.exports = recoverPayments;
