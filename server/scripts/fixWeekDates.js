const mongoose = require('mongoose');
const MainBudget = require('../models/MainBudget');
const WeeklyBudget = require('../models/WeeklyBudget');

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
    
    // Fix standalone WeeklyBudgets
    const weeklyBudgets = await WeeklyBudget.find({});
    console.log(`\nFound ${weeklyBudgets.length} weekly budgets to check`);
    
    for (const weekBudget of weeklyBudgets) {
      const weekStart = new Date(weekBudget.weekStartDate);
      const dayOfWeek = weekStart.getDay();
      
      if (dayOfWeek !== 1) { // Not Monday
        console.log(`Updating weekly budget: ${weekBudget._id}`);
        
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
        
        await weekBudget.save();
        console.log(`✓ Updated weekly budget ${weekBudget._id}`);
      }
    }
    
    console.log('\n✅ Week dates fixed successfully!');
  } catch (error) {
    console.error('Error fixing week dates:', error);
  }
}

module.exports = fixWeekDates;
