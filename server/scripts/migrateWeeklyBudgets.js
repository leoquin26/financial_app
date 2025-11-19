const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { startOfMonth, endOfMonth, startOfWeek, endOfWeek, format } = require('date-fns');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import models
const WeeklyBudget = require('../models/WeeklyBudget');
const MainBudget = require('../models/MainBudget');

// Migration report
const report = {
  totalWeeklyBudgets: 0,
  mainBudgetsCreated: 0,
  weeklyBudgetsLinked: 0,
  errors: [],
  skipped: []
};

async function migrateWeeklyBudgets() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/finance_tracker', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('🔄 Starting Weekly Budget Migration...\n');
    
    // Get all weekly budgets that don't have a parent
    const orphanWeeklyBudgets = await WeeklyBudget.find({
      parentBudgetId: { $exists: false }
    }).populate('userId', 'name email');
    
    report.totalWeeklyBudgets = orphanWeeklyBudgets.length;
    console.log(`Found ${report.totalWeeklyBudgets} weekly budgets without parent budgets\n`);
    
    // Group weekly budgets by user and month
    const groupedBudgets = new Map();
    
    for (const weeklyBudget of orphanWeeklyBudgets) {
      const monthKey = format(weeklyBudget.weekStartDate, 'yyyy-MM');
      const userKey = weeklyBudget.userId._id.toString();
      const key = `${userKey}-${monthKey}`;
      
      if (!groupedBudgets.has(key)) {
        groupedBudgets.set(key, {
          userId: weeklyBudget.userId._id,
          userName: weeklyBudget.userId.name || weeklyBudget.userId.email,
          month: monthKey,
          monthStart: startOfMonth(weeklyBudget.weekStartDate),
          monthEnd: endOfMonth(weeklyBudget.weekStartDate),
          weeklyBudgets: [],
          totalBudget: 0,
          householdId: weeklyBudget.householdId
        });
      }
      
      const group = groupedBudgets.get(key);
      group.weeklyBudgets.push(weeklyBudget);
      group.totalBudget += weeklyBudget.totalBudget;
    }
    
    console.log(`Grouped into ${groupedBudgets.size} potential main budgets\n`);
    
    // Create main budgets for each group
    for (const [key, group] of groupedBudgets) {
      try {
        console.log(`\n📅 Processing ${group.month} for user ${group.userName}`);
        console.log(`  - ${group.weeklyBudgets.length} weekly budgets found`);
        console.log(`  - Total budget: $${group.totalBudget}`);
        
        // Check if main budget already exists
        const existingMainBudget = await MainBudget.findOne({
          userId: group.userId,
          'period.startDate': { $lte: group.monthStart },
          'period.endDate': { $gte: group.monthEnd }
        });
        
        if (existingMainBudget) {
          console.log(`  ⚠️  Main budget already exists, skipping...`);
          report.skipped.push({
            month: group.month,
            user: group.userName,
            reason: 'Main budget already exists'
          });
          continue;
        }
        
        // Collect all categories from weekly budgets
        const categoryMap = new Map();
        
        for (const weeklyBudget of group.weeklyBudgets) {
          for (const category of weeklyBudget.categories) {
            const catId = category.categoryId.toString();
            if (!categoryMap.has(catId)) {
              categoryMap.set(catId, {
                categoryId: category.categoryId,
                totalAllocation: 0,
                count: 0
              });
            }
            const catData = categoryMap.get(catId);
            catData.totalAllocation += category.allocation;
            catData.count += 1;
          }
        }
        
        // Create categories array with average allocations
        const categories = Array.from(categoryMap.values()).map(cat => ({
          categoryId: cat.categoryId,
          defaultAllocation: Math.round(cat.totalAllocation / cat.count),
          percentage: 0 // Will be calculated based on total budget
        }));
        
        // Calculate percentages
        const totalAllocations = categories.reduce((sum, cat) => sum + cat.defaultAllocation, 0);
        categories.forEach(cat => {
          cat.percentage = Math.round((cat.defaultAllocation / group.totalBudget) * 100);
        });
        
        // Create the main budget
        const mainBudget = new MainBudget({
          userId: group.userId,
          name: `${format(group.monthStart, 'MMMM yyyy')} Budget (Migrated)`,
          description: `Auto-generated from ${group.weeklyBudgets.length} weekly budgets`,
          period: {
            type: 'monthly',
            startDate: group.monthStart,
            endDate: group.monthEnd
          },
          totalBudget: group.totalBudget,
          categories: categories,
          status: 'completed', // Since these are historical
          householdId: group.householdId,
          settings: {
            autoCreateWeekly: false, // Don't auto-create since we're linking existing
            weeklyBudgetAmount: Math.round(group.totalBudget / 4),
            rolloverUnspent: false,
            shareWithHousehold: !!group.householdId
          }
        });
        
        // Generate weekly budget slots
        mainBudget.weeklyBudgets = [];
        let weekNum = 1;
        
        // Sort weekly budgets by start date
        group.weeklyBudgets.sort((a, b) => a.weekStartDate - b.weekStartDate);
        
        for (const weeklyBudget of group.weeklyBudgets) {
          mainBudget.weeklyBudgets.push({
            weekNumber: weekNum++,
            budgetId: weeklyBudget._id,
            startDate: weeklyBudget.weekStartDate,
            endDate: weeklyBudget.weekEndDate,
            allocatedAmount: weeklyBudget.totalBudget,
            status: 'completed'
          });
        }
        
        await mainBudget.save();
        report.mainBudgetsCreated++;
        
        console.log(`  ✅ Created main budget: ${mainBudget.name}`);
        
        // Update weekly budgets with parent reference
        for (const weeklyBudget of group.weeklyBudgets) {
          const weekData = mainBudget.weeklyBudgets.find(
            w => w.budgetId.toString() === weeklyBudget._id.toString()
          );
          
          if (weekData) {
            weeklyBudget.parentBudgetId = mainBudget._id;
            weeklyBudget.weekNumber = weekData.weekNumber;
            await weeklyBudget.save();
            report.weeklyBudgetsLinked++;
            console.log(`  ✅ Linked week ${weekData.weekNumber}: ${format(weeklyBudget.weekStartDate, 'MMM d')}`);
          }
        }
        
        // Update analytics
        await mainBudget.updateAnalytics();
        await mainBudget.save();
        
      } catch (error) {
        console.error(`  ❌ Error processing ${group.month}:`, error.message);
        report.errors.push({
          month: group.month,
          user: group.userName,
          error: error.message
        });
      }
    }
    
    // Migration complete
    console.log('\n\n📊 Migration Report:');
    console.log('===================');
    console.log(`Total Weekly Budgets: ${report.totalWeeklyBudgets}`);
    console.log(`Main Budgets Created: ${report.mainBudgetsCreated}`);
    console.log(`Weekly Budgets Linked: ${report.weeklyBudgetsLinked}`);
    console.log(`Skipped: ${report.skipped.length}`);
    console.log(`Errors: ${report.errors.length}`);
    
    if (report.skipped.length > 0) {
      console.log('\n⚠️  Skipped:');
      report.skipped.forEach(skip => {
        console.log(`  - ${skip.month} (${skip.user}): ${skip.reason}`);
      });
    }
    
    if (report.errors.length > 0) {
      console.log('\n❌ Errors:');
      report.errors.forEach(err => {
        console.log(`  - ${err.month} (${err.user}): ${err.error}`);
      });
    }
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
  }
}

// Add command line options
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

// Run migration
migrateWeeklyBudgets();
