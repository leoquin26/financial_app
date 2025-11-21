const mongoose = require('mongoose');
const MainBudget = require('../models/MainBudget');
const WeeklyBudget = require('../models/WeeklyBudget');
const Transaction = require('../models/Transaction');

async function fixWeekDates() {
  try {
    console.log('Fixing week dates to use Monday-Sunday...');
    
    // Fix MainBudget weekly breakdowns
    const mainBudgets = await MainBudget.find({});
    console.log(`Found ${mainBudgets.length} main budgets to check`);
    
    for (const budget of mainBudgets) {
      let needsUpdate = false;
      
      // Check if any week doesn't start on Monday
      for (const week of budget.weeklyBudgets) {
        const weekStart = new Date(week.startDate);
        const dayOfWeek = weekStart.getDay();
        
        if (dayOfWeek !== 1) { // Not Monday
          needsUpdate = true;
          break;
        }
      }
      
      if (needsUpdate) {
        console.log(`Updating budget: ${budget.name}`);
        
        // Regenerate weekly budgets with correct dates
        budget.weeklyBudgets = budget.generateWeeklyBudgets();
        
        // Preserve existing budget IDs and statuses
        const oldWeeks = await MainBudget.findById(budget._id).select('weeklyBudgets');
        if (oldWeeks) {
          oldWeeks.weeklyBudgets.forEach((oldWeek, index) => {
            if (index < budget.weeklyBudgets.length && oldWeek.budgetId) {
              budget.weeklyBudgets[index].budgetId = oldWeek.budgetId;
              budget.weeklyBudgets[index].status = oldWeek.status;
            }
          });
        }
        
        await budget.save();
        console.log(`✓ Updated ${budget.name}`);
      }
    }
    
    // Fix standalone WeeklyBudgets and reassign payments
    const weeklyBudgets = await WeeklyBudget.find({})
      .populate('categories.categoryId');
    console.log(`\nFound ${weeklyBudgets.length} weekly budgets to check`);
    
    for (const weekBudget of weeklyBudgets) {
      const weekStart = new Date(weekBudget.weekStartDate);
      const dayOfWeek = weekStart.getDay();
      let needsUpdate = false;
      
      if (dayOfWeek !== 1) { // Not Monday
        needsUpdate = true;
        console.log(`Updating weekly budget: ${weekBudget._id}`);
        console.log(`  Old dates: ${weekBudget.weekStartDate} - ${weekBudget.weekEndDate}`);
        
        // Calculate the correct Monday
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const correctMonday = new Date(weekStart);
        correctMonday.setDate(weekStart.getDate() + daysToMonday);
        correctMonday.setHours(0, 0, 0, 0);
        
        // Calculate the correct Sunday
        const correctSunday = new Date(correctMonday);
        correctSunday.setDate(correctMonday.getDate() + 6);
        correctSunday.setHours(23, 59, 59, 999);
        
        weekBudget.weekStartDate = correctMonday;
        weekBudget.weekEndDate = correctSunday;
        
        console.log(`  New dates: ${correctMonday} - ${correctSunday}`);
      }
      
      // Check for payments that don't belong to this week
      let paymentsRemoved = 0;
      let paymentsKept = 0;
      
      for (const category of weekBudget.categories) {
        const paymentsToKeep = [];
        
        for (const payment of category.payments) {
          const paymentDate = payment.paidDate || payment.scheduledDate;
          if (paymentDate) {
            const paymentDateObj = new Date(paymentDate);
            
            // Check if payment is within the week boundaries
            if (paymentDateObj >= weekBudget.weekStartDate && paymentDateObj <= weekBudget.weekEndDate) {
              paymentsToKeep.push(payment);
              paymentsKept++;
            } else {
              paymentsRemoved++;
              console.log(`  Removing payment "${payment.name}" dated ${paymentDateObj} from week`);
              
              // If this payment has a transactionId, we'll need to find the correct week for it
              if (payment.transactionId) {
                console.log(`    (Will reassign transaction ${payment.transactionId} to correct week)`);
              }
            }
          } else {
            // Keep payments without dates (shouldn't happen, but being safe)
            paymentsToKeep.push(payment);
            paymentsKept++;
          }
        }
        
        category.payments = paymentsToKeep;
      }
      
      if (needsUpdate || paymentsRemoved > 0) {
        await weekBudget.save();
        console.log(`✓ Updated weekly budget ${weekBudget._id}`);
        console.log(`  Kept ${paymentsKept} payments, removed ${paymentsRemoved} payments`);
      }
    }
    
    console.log('\n✅ Week dates fixed successfully!');
    
    // Now check for orphaned transactions that need to be reassigned
    console.log('\nChecking for transactions that need reassignment...');
    const allTransactions = await Transaction.find({ type: 'expense' });
    let reassigned = 0;
    
    for (const transaction of allTransactions) {
      const transactionDate = new Date(transaction.date);
      
      // Find the correct week for this transaction
      const correctWeek = await WeeklyBudget.findOne({
        userId: transaction.userId,
        weekStartDate: { $lte: transactionDate },
        weekEndDate: { $gte: transactionDate }
      });
      
      if (correctWeek) {
        // Check if this transaction is already in the correct week
        let found = false;
        for (const category of correctWeek.categories) {
          if (category.payments.some(p => p.transactionId?.toString() === transaction._id.toString())) {
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log(`Reassigning transaction "${transaction.description}" to week ${correctWeek.weekStartDate}`);
          reassigned++;
          // The transaction will be picked up by the weekly budget endpoint when fetched
        }
      }
    }
    
    if (reassigned > 0) {
      console.log(`\n✅ ${reassigned} transactions will be reassigned to correct weeks`);
    }
    
  } catch (error) {
    console.error('Error fixing week dates:', error);
  }
}

module.exports = fixWeekDates;
