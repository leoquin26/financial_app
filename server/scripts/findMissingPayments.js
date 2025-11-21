const mongoose = require('mongoose');
const connectDB = require('../config/db');
const WeeklyBudget = require('../models/WeeklyBudget');
const Transaction = require('../models/Transaction');
const PaymentSchedule = require('../models/PaymentSchedule');

async function findMissingPayments() {
  try {
    // Connect to database
    await connectDB();
    
    console.log('🔍 Looking for all payments around Nov 19, 2025...\n');
    
    // Check a wider date range
    const startDate = new Date('2025-11-17');
    const endDate = new Date('2025-11-23');
    
    // Find all weekly budgets in November
    const novemberBudgets = await WeeklyBudget.find({
      $or: [
        { weekStartDate: { $gte: new Date('2025-11-01'), $lte: new Date('2025-11-30') } },
        { weekEndDate: { $gte: new Date('2025-11-01'), $lte: new Date('2025-11-30') } }
      ]
    }).populate('categories.categoryId').sort('weekStartDate');
    
    console.log(`Found ${novemberBudgets.length} weekly budgets in November 2025:\n`);
    
    // Show all budgets and their payments
    for (const budget of novemberBudgets) {
      console.log(`📅 Week ${budget.weekNumber || '?'}: ${budget.weekStartDate.toDateString()} - ${budget.weekEndDate.toDateString()}`);
      console.log(`   Budget ID: ${budget._id}`);
      
      let totalPayments = 0;
      let totalAmount = 0;
      
      budget.categories.forEach(cat => {
        if (cat.payments.length > 0) {
          console.log(`   📁 ${cat.categoryId?.name || 'Unknown Category'}:`);
          cat.payments.forEach(payment => {
            const paymentDate = payment.paidDate || payment.scheduledDate;
            console.log(`      - ${payment.name}: $${payment.amount} (${paymentDate ? new Date(paymentDate).toDateString() : 'No date'})`);
            totalPayments++;
            totalAmount += payment.amount;
          });
        }
      });
      
      console.log(`   💰 Total: ${totalPayments} payments, $${totalAmount.toFixed(2)}\n`);
    }
    
    // Check transactions from Nov 19
    console.log('\n📊 Checking transactions from Nov 19:');
    const nov19Transactions = await Transaction.find({
      date: {
        $gte: new Date('2025-11-19T00:00:00'),
        $lte: new Date('2025-11-19T23:59:59')
      },
      type: 'expense'
    }).populate('categoryId');
    
    console.log(`Found ${nov19Transactions.length} transactions on Nov 19:`);
    nov19Transactions.forEach(t => {
      console.log(`  - ${t.description || t.categoryId?.name}: $${t.amount} (Transaction ID: ${t._id})`);
    });
    
    // Check payment schedules
    console.log('\n📅 Checking payment schedules for Nov 19:');
    const nov19Schedules = await PaymentSchedule.find({
      $or: [
        { dueDate: { $gte: new Date('2025-11-19T00:00:00'), $lte: new Date('2025-11-19T23:59:59') } },
        { paidDate: { $gte: new Date('2025-11-19T00:00:00'), $lte: new Date('2025-11-19T23:59:59') } }
      ]
    }).populate('categoryId');
    
    console.log(`Found ${nov19Schedules.length} payment schedules:`);
    nov19Schedules.forEach(p => {
      console.log(`  - ${p.name}: $${p.amount} (${p.status}) - Schedule ID: ${p._id}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error finding payments:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  findMissingPayments();
}

module.exports = findMissingPayments;
