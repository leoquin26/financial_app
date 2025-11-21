const mongoose = require('mongoose');
const connectDB = require('../config/db');
const WeeklyBudget = require('../models/WeeklyBudget');
const Transaction = require('../models/Transaction');

async function fixWeek3Payments() {
  try {
    // Connect to database
    await connectDB();
    
    console.log('Fixing Week 3 payment assignments...\n');
    
    // Find all weekly budgets
    const weeklyBudgets = await WeeklyBudget.find({})
      .populate('categories.categoryId');
    
    console.log(`Found ${weeklyBudgets.length} weekly budgets\n`);
    
    for (const budget of weeklyBudgets) {
      console.log(`\nChecking budget: ${budget._id}`);
      console.log(`Week ${budget.weekNumber || 'N/A'}: ${budget.weekStartDate.toDateString()} - ${budget.weekEndDate.toDateString()}`);
      
      let modified = false;
      let paymentsRemoved = [];
      
      // Check each category's payments
      for (const category of budget.categories) {
        const validPayments = [];
        
        for (const payment of category.payments) {
          const paymentDate = payment.paidDate || payment.scheduledDate;
          
          if (paymentDate) {
            const paymentDateObj = new Date(paymentDate);
            
            // Check if payment falls within this week's boundaries
            if (paymentDateObj >= budget.weekStartDate && paymentDateObj <= budget.weekEndDate) {
              validPayments.push(payment);
            } else {
              console.log(`  ❌ Payment "${payment.name}" (${payment.amount}) on ${paymentDateObj.toDateString()}`);
              console.log(`     Does NOT belong to this week!`);
              paymentsRemoved.push({
                payment,
                category: category.categoryId?.name || 'Unknown',
                date: paymentDateObj
              });
              modified = true;
            }
          } else {
            // Keep payments without dates
            validPayments.push(payment);
          }
        }
        
        if (category.payments.length !== validPayments.length) {
          console.log(`  Category ${category.categoryId?.name}: ${category.payments.length} -> ${validPayments.length} payments`);
          category.payments = validPayments;
        }
      }
      
      if (modified) {
        // Recalculate allocations
        for (const category of budget.categories) {
          const totalPayments = category.payments.reduce((sum, p) => sum + p.amount, 0);
          if (category.allocation < totalPayments) {
            category.allocation = totalPayments;
          }
        }
        
        await budget.save();
        console.log(`  ✅ Updated budget, removed ${paymentsRemoved.length} out-of-range payments`);
        
        // Log removed payments for potential reassignment
        if (paymentsRemoved.length > 0) {
          console.log('\n  Removed payments that need reassignment:');
          for (const removed of paymentsRemoved) {
            console.log(`    - ${removed.payment.name} (${removed.category}): ${removed.date.toDateString()}`);
          }
        }
      } else {
        console.log(`  ✅ All payments are within the correct week`);
      }
    }
    
    console.log('\n✅ Week payment validation complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing week payments:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixWeek3Payments();
}

module.exports = fixWeek3Payments;
