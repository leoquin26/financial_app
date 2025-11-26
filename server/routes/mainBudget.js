const express = require('express');
const router = express.Router();
const MainBudget = require('../models/MainBudget');
const WeeklyBudget = require('../models/WeeklyBudget');
const Category = require('../models/Category');
const PaymentSchedule = require('../models/PaymentSchedule');
const { authMiddleware: auth } = require('../middleware/auth');
const mongoose = require('mongoose');
const { startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } = require('date-fns');
const { es } = require('date-fns/locale');

// Get all main budgets for user
router.get('/', auth, async (req, res) => {
  try {
    const { status, period, year, month, householdId } = req.query;
    
    const query = { userId: req.user._id };
    
    if (status) query.status = status;
    if (period) query['period.type'] = period;
    if (year) query['period.year'] = parseInt(year);
    if (month) query['period.month'] = parseInt(month);
    if (householdId) query.householdId = householdId;
    
    const budgets = await MainBudget.find(query)
      .populate('categories.categoryId', 'name color icon')
      .populate('weeklyBudgets.budgetId', 'totalBudget categories')
      .sort({ 'period.startDate': -1 });
    
    // Update analytics for each budget and update week statuses
    for (const budget of budgets) {
      await budget.updateAnalytics();
      
      // Update week statuses based on dates
      const now = new Date();
      let hasChanges = false;
      
      for (const week of budget.weeklyBudgets) {
        const weekStart = new Date(week.startDate);
        const weekEnd = new Date(week.endDate);
        
        // Determine the correct status based on dates
        let correctStatus;
        if (weekEnd < now && week.budgetId) {
          correctStatus = 'completed';
        } else if (weekStart <= now && weekEnd >= now && week.budgetId) {
          correctStatus = 'active';
        } else {
          correctStatus = 'pending';
        }
        
        // Update if status is different
        if (week.status !== correctStatus) {
          week.status = correctStatus;
          hasChanges = true;
        }
      }
      
      if (hasChanges) {
        await budget.save();
      }
    }
    
    res.json(budgets);
  } catch (error) {
    console.error('Error fetching main budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Get single main budget
router.get('/:id', auth, async (req, res) => {
  try {
    const budget = await MainBudget.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households } }
      ]
    })
    .populate('categories.categoryId', 'name color icon')
    .populate('weeklyBudgets.budgetId')
    .populate('householdId', 'name members');
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    await budget.updateAnalytics();
    await budget.save();
    
    res.json(budget);
  } catch (error) {
    console.error('Error fetching budget:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Create new main budget
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      description,
      periodType,
      customStartDate,
      customEndDate,
      totalBudget,
      categories,
      settings,
      householdId
    } = req.body;
    
    // Validate required fields
    if (!name || !periodType || totalBudget === undefined || totalBudget === null) {
      return res.status(400).json({ error: 'Name, period type, and total budget are required' });
    }
    
    // Validate totalBudget is a number
    if (typeof totalBudget !== 'number' || totalBudget < 0) {
      return res.status(400).json({ error: 'Total budget must be a non-negative number' });
    }
    
    // Calculate period dates based on type
    let startDate, endDate;
    const now = new Date();
    
    switch (periodType) {
      case 'monthly':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarterly':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'yearly':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case 'custom':
        if (!customStartDate || !customEndDate) {
          return res.status(400).json({ error: 'Start and end dates required for custom period' });
        }
        startDate = new Date(customStartDate);
        endDate = new Date(customEndDate);
        break;
      default:
        return res.status(400).json({ error: 'Invalid period type' });
    }
    
    // Validate categories if provided
    if (categories && categories.length > 0) {
      const categoryIds = categories.map(c => c.categoryId);
      const validCategories = await Category.find({
        _id: { $in: categoryIds },
        $or: [
          { userId: req.user._id },
          { userId: null } // System categories
        ]
      });
      
      if (validCategories.length !== categoryIds.length) {
        return res.status(400).json({ error: 'Invalid categories provided' });
      }
    }
    
    // Check for household permissions if sharing
    if (householdId && householdId !== '') {
      const Household = require('../models/Household');
      const household = await Household.findOne({
        _id: householdId,
        $or: [
          { createdBy: req.user._id },
          { 'members.user': req.user._id }
        ]
      });
      
      if (!household) {
        return res.status(403).json({ error: 'No access to this household' });
      }
    }
    
    // Create the main budget
    const mainBudget = new MainBudget({
      userId: req.user._id,
      householdId: householdId && householdId !== '' ? householdId : undefined,
      name,
      description,
      period: {
        type: periodType,
        startDate,
        endDate
      },
      totalBudget,
      categories: categories || [],
      settings: {
        autoCreateWeekly: true,
        weeklyBudgetAmount: Math.floor(totalBudget / 4), // Default to 4 weeks
        ...settings
      },
      status: 'active'
    });
    
    // Generate weekly budget placeholders
    mainBudget.weeklyBudgets = mainBudget.generateWeeklyBudgets();
    
    await mainBudget.save();
    
    // Populate for response
    await mainBudget.populate('categories.categoryId', 'name color icon');
    
    // Auto-create first weekly budget if enabled
    if (mainBudget.settings.autoCreateWeekly) {
      const firstWeek = mainBudget.weeklyBudgets[0];
      if (firstWeek) {
        const weeklyBudget = await createWeeklyBudgetFromMain(
          mainBudget,
          firstWeek.weekNumber,
          req.user._id
        );
        
        if (weeklyBudget) {
          // Update the specific week in the array, not the reference
          const weekIndex = mainBudget.weeklyBudgets.findIndex(w => w.weekNumber === firstWeek.weekNumber);
          if (weekIndex !== -1) {
            mainBudget.weeklyBudgets[weekIndex].budgetId = weeklyBudget._id;
            mainBudget.weeklyBudgets[weekIndex].status = 'active';
          }
          await mainBudget.save();
        }
      }
    }
    
    res.status(201).json(mainBudget);
  } catch (error) {
    console.error('Error creating main budget:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Update main budget
router.put('/:id', auth, async (req, res) => {
  try {
    const budget = await MainBudget.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    const {
      name,
      description,
      totalBudget,
      categories,
      settings
    } = req.body;
    
    // Update allowed fields
    if (name) budget.name = name;
    if (description !== undefined) budget.description = description;
    if (totalBudget && budget.status === 'draft') {
      budget.totalBudget = totalBudget;
    }
    if (categories) budget.categories = categories;
    if (settings) budget.settings = { ...budget.settings, ...settings };
    
    await budget.save();
    await budget.populate('categories.categoryId', 'name color icon');
    
    res.json(budget);
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Generate or get weekly budget for a specific week
router.post('/:id/weekly/:weekNumber', auth, async (req, res) => {
  try {
    const { id, weekNumber } = req.params;
    const weekNum = parseInt(weekNumber);
    
    const mainBudget = await MainBudget.findOne({
      _id: id,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households } }
      ]
    });
    
    if (!mainBudget) {
      return res.status(404).json({ error: 'Main budget not found' });
    }
    
    // Find the week in the budget
    const weekData = mainBudget.weeklyBudgets.find(w => w.weekNumber === weekNum);
    if (!weekData) {
      return res.status(404).json({ error: 'Week not found in budget period' });
    }
    
    // Check if weekly budget already exists
    if (weekData.budgetId) {
      const existingBudget = await WeeklyBudget.findById(weekData.budgetId)
        .populate('categories.categoryId')
        .populate('categories.payments.paidBy', 'name email');
      
      if (existingBudget) {
        return res.json(existingBudget);
      }
    }
    
    // Create new weekly budget
    const weeklyBudget = await createWeeklyBudgetFromMain(
      mainBudget,
      weekNum,
      req.user._id
    );
    
    // Update main budget with the reference and budget amount
    const weekIndex = mainBudget.weeklyBudgets.findIndex(w => w.weekNumber === weekNum);
    if (weekIndex !== -1) {
      mainBudget.weeklyBudgets[weekIndex].budgetId = weeklyBudget._id;
      mainBudget.weeklyBudgets[weekIndex].status = 'active';
      // Update allocatedAmount to match the weekly budget
      if (weeklyBudget.totalBudget > 0) {
        mainBudget.weeklyBudgets[weekIndex].allocatedAmount = weeklyBudget.totalBudget;
      }
      await mainBudget.save();
    }
    
    res.status(201).json(weeklyBudget);
  } catch (error) {
    console.error('Error creating weekly budget:', error);
    res.status(500).json({ error: 'Failed to create weekly budget' });
  }
});

// Get summary/analytics for main budget
router.get('/:id/summary', auth, async (req, res) => {
  try {
    const budget = await MainBudget.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households } }
      ]
    })
    .populate('weeklyBudgets.budgetId', 'categories totalBudget')
    .populate('categories.categoryId', 'name color icon');
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Calculate detailed analytics
    const summary = {
      overview: {
        totalBudget: budget.totalBudget,
        totalSpent: 0,
        totalRemaining: budget.totalBudget,
        progressPercentage: 0,
        daysRemaining: budget.daysRemaining,
        weeksCompleted: 0,
        weeksTotal: budget.weeklyBudgets.length
      },
      categoryBreakdown: [],
      weeklyProgress: [],
      trends: {
        averageWeeklySpend: 0,
        projectedTotal: 0,
        onTrack: true
      }
    };
    
    // Calculate category breakdown
    const categorySpending = new Map();
    
    for (const week of budget.weeklyBudgets) {
      if (week.budgetId) {
        const weeklyBudget = await WeeklyBudget.findById(week.budgetId);
        if (weeklyBudget) {
          let weekTotal = 0;
          
          // Sum up spending by category
          for (const category of weeklyBudget.categories) {
            const categoryId = category.categoryId.toString();
            const spent = category.payments
              .filter(p => p.status === 'paid')
              .reduce((sum, p) => sum + p.amount, 0);
            
            weekTotal += spent;
            
            if (categorySpending.has(categoryId)) {
              categorySpending.get(categoryId).spent += spent;
            } else {
              const mainCategory = budget.categories.find(
                c => c.categoryId.toString() === categoryId
              );
              categorySpending.set(categoryId, {
                categoryId: category.categoryId,
                name: mainCategory?.categoryId?.name || 'Unknown',
                color: mainCategory?.categoryId?.color || '#ccc',
                icon: mainCategory?.categoryId?.icon || '📁',
                allocated: mainCategory?.defaultAllocation || 0,
                spent: spent
              });
            }
          }
          
          summary.weeklyProgress.push({
            weekNumber: week.weekNumber,
            startDate: week.startDate,
            endDate: week.endDate,
            allocated: week.allocatedAmount,
            spent: weekTotal,
            status: week.status
          });
          
          summary.overview.totalSpent += weekTotal;
          if (week.status === 'completed') {
            summary.overview.weeksCompleted++;
          }
        }
      }
    }
    
    // Convert category map to array
    summary.categoryBreakdown = Array.from(categorySpending.values());
    
    // Update overview
    summary.overview.totalRemaining = budget.totalBudget - summary.overview.totalSpent;
    summary.overview.progressPercentage = budget.totalBudget > 0
      ? Math.round((summary.overview.totalSpent / budget.totalBudget) * 100)
      : 0;
    
    // Calculate trends
    if (summary.overview.weeksCompleted > 0) {
      summary.trends.averageWeeklySpend = Math.round(
        summary.overview.totalSpent / summary.overview.weeksCompleted
      );
      summary.trends.projectedTotal = Math.round(
        summary.trends.averageWeeklySpend * summary.overview.weeksTotal
      );
      summary.trends.onTrack = summary.trends.projectedTotal <= budget.totalBudget;
    }
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching budget summary:', error);
    res.status(500).json({ error: 'Failed to fetch budget summary' });
  }
});

// Helper function to create weekly budget from main budget
async function createWeeklyBudgetFromMain(mainBudget, weekNumber, userId) {
  const weekData = mainBudget.weeklyBudgets.find(w => w.weekNumber === weekNumber);
  if (!weekData) {
    throw new Error('Week not found in main budget');
  }
  
  // Check if this week is in the future
  const now = new Date();
  const weekStart = new Date(weekData.startDate);
  const weekEnd = new Date(weekData.endDate);
  
  // A week is considered current if today falls within the week's date range
  const isCurrentWeek = weekStart <= now && weekEnd >= now;
  const isPastWeek = weekEnd < now;
  const isCurrentOrPastWeek = isCurrentWeek || isPastWeek;
  
  
  // Create categories structure from main budget
  // If main budget has no categories, create an empty array
  const categories = mainBudget.categories && mainBudget.categories.length > 0
    ? mainBudget.categories.map(cat => ({
        categoryId: cat.categoryId._id || cat.categoryId,
        allocation: cat.defaultAllocation || 
          Math.floor((cat.percentage || 0) * weekData.allocatedAmount / 100),
        payments: []
      }))
    : [];
  
  // Create the weekly budget
  const weeklyBudget = new WeeklyBudget({
    userId,
    parentBudgetId: mainBudget._id,
    weekNumber: weekNumber,
    householdId: mainBudget.householdId,
    isSharedWithHousehold: mainBudget.settings.shareWithHousehold,
    weekStartDate: weekData.startDate,
    weekEndDate: weekData.endDate,
    totalBudget: weekData.allocatedAmount,
    categories,
    creationMode: 'fromMainBudget',
    allocations: [], // Using new structure
    scheduledPayments: [],
    remainingBudget: weekData.allocatedAmount
  });
  
  // Only add scheduled payments if this is the current or a past week
  // Future weeks should start empty
  if (isCurrentOrPastWeek) {
    // Find any scheduled payments for this week
    const payments = await PaymentSchedule.find({
      userId,
      dueDate: {
        $gte: weekData.startDate,
        $lte: weekData.endDate
      }
    }).populate('categoryId');
    
    // Add payments to appropriate categories
    for (const payment of payments) {
      const categoryIndex = categories.findIndex(
        c => c.categoryId.toString() === payment.categoryId._id.toString()
      );
      
      if (categoryIndex !== -1) {
        weeklyBudget.categories[categoryIndex].payments.push({
          name: payment.name,
          amount: payment.amount,
          scheduledDate: payment.dueDate,
          status: payment.status,
          paymentScheduleId: payment._id,
          isRecurring: payment.isRecurring,
          notes: payment.notes
        });
        
        // Link payment to weekly budget
        payment.weeklyBudgetId = weeklyBudget._id;
        if (mainBudget.householdId) {
          payment.householdId = mainBudget.householdId;
        }
        await payment.save();
      }
    }
  }
  
  weeklyBudget.updateRemainingBudget();
  await weeklyBudget.save();
  
  // Populate for return
  await weeklyBudget.populate('categories.categoryId');
  
  return weeklyBudget;
}

// Archive/Complete a main budget
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const budget = await MainBudget.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    budget.status = status;
    await budget.save();
    
    res.json({ message: 'Budget status updated', budget });
  } catch (error) {
    console.error('Error updating budget status:', error);
    res.status(500).json({ error: 'Failed to update budget status' });
  }
});

// Delete main budget (only if draft)
// Clean up future weekly budgets that shouldn't have data
router.post('/:id/cleanup-future-weeks', auth, async (req, res) => {
  try {
    const mainBudget = await MainBudget.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!mainBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    const now = new Date();
    let cleanedCount = 0;
    
    // Check each weekly budget
    for (const week of mainBudget.weeklyBudgets) {
      if (week.budgetId) {
        const weekStart = new Date(week.startDate);
        const weekEnd = new Date(week.endDate);
        const isFutureWeek = weekStart > now;
        
        if (isFutureWeek) {
          // Delete the future weekly budget
          await WeeklyBudget.findByIdAndDelete(week.budgetId);
          
          // Reset the week data
          week.budgetId = null;
          week.status = 'pending';
          cleanedCount++;
          
        }
      }
    }
    
    if (cleanedCount > 0) {
      await mainBudget.save();
    }
    
    res.json({ 
      message: `Cleaned ${cleanedCount} future weekly budgets`,
      cleanedCount 
    });
  } catch (error) {
    console.error('Error cleaning future weeks:', error);
    res.status(500).json({ error: 'Failed to clean future weeks' });
  }
});

// Recalculate total budget from weekly allocations
router.post('/:id/recalculate-total', auth, async (req, res) => {
  try {
    const mainBudget = await MainBudget.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households } }
      ]
    });
    
    if (!mainBudget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Calculate total from weekly allocations
    let newTotal = 0;
    for (const week of mainBudget.weeklyBudgets) {
      newTotal += week.allocatedAmount || 0;
    }
    
    // Update the total budget
    mainBudget.totalBudget = newTotal;
    await mainBudget.save();
    
    // Update analytics
    await mainBudget.updateAnalytics();
    await mainBudget.save();
    
    // Populate and return
    await mainBudget.populate('categories.categoryId', 'name color icon');
    await mainBudget.populate('weeklyBudgets.budgetId');
    
    console.log(`Recalculated budget ${mainBudget.name}: total = ${newTotal}`);
    
    res.json({
      ...mainBudget.toObject(),
      message: `Total budget updated to $${newTotal.toFixed(2)}`
    });
  } catch (error) {
    console.error('Error recalculating budget:', error);
    res.status(500).json({ error: 'Failed to recalculate budget' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const budget = await MainBudget.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households || [] } }
      ]
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Allow deletion of any budget status - users should be able to clean up their data
    // The frontend will show appropriate warnings
    
    // Delete all related weekly budgets
    const WeeklyBudget = require('../models/WeeklyBudget');
    const weeklyBudgetIds = budget.weeklyBudgets
      .filter(w => w.budgetId)
      .map(w => w.budgetId);
    
    if (weeklyBudgetIds.length > 0) {
      await WeeklyBudget.deleteMany({
        _id: { $in: weeklyBudgetIds }
      });
    }
    
    // Delete the main budget
    await budget.deleteOne();
    
    res.json({ 
      message: 'Budget deleted successfully',
      deletedWeeklyBudgets: weeklyBudgetIds.length
    });
  } catch (error) {
    console.error('Error deleting budget:', error);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

// Create quick monthly budget (full month, not weekly)
router.post('/quick-monthly', auth, async (req, res) => {
  try {
    const { type } = req.body;
    
    if (type !== 'monthly') {
      return res.status(400).json({ error: 'Invalid budget type' });
    }
    
    // Get current month dates
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Check if a budget already exists for this month
    const existingBudget = await MainBudget.findOne({
      userId: req.user._id,
      'period.startDate': { $lte: endDate },
      'period.endDate': { $gte: startDate },
      status: { $ne: 'deleted' }
    });
    
    if (existingBudget) {
      return res.status(400).json({ 
        error: 'Ya existe un presupuesto para este mes',
        budget: existingBudget 
      });
    }
    
    // Get default categories
    const Category = require('../models/Category');
    const defaultCategories = await Category.find({
      $or: [
        { isDefault: true },
        { name: { $in: ['Alimentación', 'Transporte', 'Otros Gastos'] } }
      ]
    }).limit(4);
    
    // Calculate monthly budget (assuming 4 weeks)
    const weeklyAmount = 350; // Default weekly amount
    const monthlyBudget = weeklyAmount * 4;
    
    // Create allocations with default categories
    const allocations = defaultCategories.map(category => ({
      categoryId: category._id,
      amount: monthlyBudget / defaultCategories.length, // Divide equally
      spent: 0
    }));
    
    // Create the main budget
    const mainBudget = new MainBudget({
      userId: req.user._id,
      name: `Presupuesto ${format(startDate, 'MMMM yyyy', { locale: es })}`,
      period: {
        type: 'monthly',
        startDate,
        endDate
      },
      totalBudget: monthlyBudget,
      allocations,
      status: 'active',
      autoGenerateWeekly: false // Don't generate weekly budgets for full month
    });
    
    await mainBudget.save();
    
    // Don't generate weekly budgets for a full monthly budget
    // The user will manage the entire month as one budget
    
    res.json({
      message: 'Presupuesto mensual creado exitosamente',
      budget: mainBudget
    });
  } catch (error) {
    console.error('Error creating quick monthly budget:', error);
    res.status(500).json({ error: 'Error al crear presupuesto mensual' });
  }
});

module.exports = router;
