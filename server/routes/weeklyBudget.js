const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware: auth } = require('../middleware/auth');
const WeeklyBudget = require('../models/WeeklyBudget');
const PaymentSchedule = require('../models/PaymentSchedule');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const MainBudget = require('../models/MainBudget');
const { format } = require('date-fns');

// Helper function to generate budget insights
async function generateBudgetInsights(userId, budget = null) {
  try {
    // Get last 12 weeks of data
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    
    const historicalBudgets = await WeeklyBudget.find({
      userId,
      weekStartDate: { $gte: twelveWeeksAgo }
    }).populate('categories.categoryId');
    
    if (historicalBudgets.length < 3) {
      return {
        averageWeeklySpending: 0,
        topCategories: [],
        savingsRate: 0,
        recommendations: ['Create more budgets to unlock insights']
      };
    }
    
    // Calculate averages
    const categoryTotals = {};
    let totalSpending = 0;
    
    historicalBudgets.forEach(b => {
      b.categories?.forEach(cat => {
        const spent = cat.payments.reduce((sum, p) => 
          p.status === 'paid' ? sum + p.amount : sum, 0
        );
        
        if (!categoryTotals[cat.categoryId._id]) {
          categoryTotals[cat.categoryId._id] = {
            name: cat.categoryId.name,
            total: 0,
            count: 0,
            amounts: []
          };
        }
        
        categoryTotals[cat.categoryId._id].total += spent;
        categoryTotals[cat.categoryId._id].count += 1;
        categoryTotals[cat.categoryId._id].amounts.push(spent);
        totalSpending += spent;
      });
    });
    
    // Calculate trends
    const topCategories = Object.entries(categoryTotals)
      .map(([id, data]) => {
        const average = data.total / data.count;
        const recent = data.amounts.slice(-3).reduce((a, b) => a + b, 0) / 3;
        const older = data.amounts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        
        return {
          categoryId: id,
          name: data.name,
          average: Math.round(average),
          trend: recent > older * 1.1 ? 'up' : recent < older * 0.9 ? 'down' : 'stable'
        };
      })
      .sort((a, b) => b.average - a.average)
      .slice(0, 5);
    
    const averageWeeklySpending = Math.round(totalSpending / historicalBudgets.length);
    
    // Generate recommendations
    const recommendations = [];
    topCategories.forEach(cat => {
      if (cat.trend === 'up') {
        recommendations.push(`Your ${cat.name} spending is trending up. Consider reviewing this category.`);
      }
    });
    
    return {
      averageWeeklySpending,
      topCategories,
      savingsRate: 0, // TODO: Calculate based on income
      recommendations: recommendations.slice(0, 3),
      suggestedTotal: averageWeeklySpending * 1.05 // 5% buffer
    };
  } catch (error) {
    console.error('Error generating insights:', error);
    return null;
  }
}

// Helper function to create smart budget
async function createSmartBudget(userId, weekStartDate, insights) {
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);
  
  const categories = insights.topCategories.map(cat => ({
    categoryId: cat.categoryId,
    allocation: cat.average * 1.1, // 10% buffer
    payments: []
  }));
  
  return new WeeklyBudget({
    userId,
    weekStartDate,
    weekEndDate,
    totalBudget: insights.suggestedTotal,
    creationMode: 'smart',
    categories,
    insights: {
      suggestedTotal: insights.suggestedTotal,
      topCategories: insights.topCategories,
      recommendations: insights.recommendations,
      lastAnalyzed: new Date()
    }
  });
}

// Get current week's budget
router.get('/current', auth, async (req, res) => {
  try {
    console.log('Getting current week budget for user:', req.user);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'User not authenticated properly' });
    }
    
    let budget = await WeeklyBudget.getCurrentWeek(req.user._id);
    
    if (!budget) {
      // Auto-create budget for current week
      const now = new Date();
      const startOfWeek = new Date(now);
      // Calculate Monday as start of week
      const dayOfWeek = now.getDay();
      const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startOfWeek.setDate(now.getDate() + daysToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Get Quick Payment category to include it by default
      const quickPaymentCategory = await Category.findOne({
        name: 'Quick Payment',
        isSystem: true
      });
      
      const initialCategories = [];
      if (quickPaymentCategory) {
        initialCategories.push({
          categoryId: quickPaymentCategory._id,
          allocation: 0,
          payments: []
        });
        console.log('Added Quick Payment category to new budget');
      }
      
      budget = new WeeklyBudget({
        userId: req.user._id,
        weekStartDate: startOfWeek,
        weekEndDate: endOfWeek,
        totalBudget: 0,
        allocations: [],
        categories: initialCategories,
        creationMode: 'manual'
      });
      
      await budget.save();
    }

    // Populate categories
    await budget.populate('categories.categoryId');
    await budget.populate('categories.payments.paidBy', 'name email');
    
    console.log('Budget categories after populate:', budget.categories.map(cat => ({
      categoryName: cat.categoryId?.name,
      categoryId: cat.categoryId?._id,
      paymentsCount: cat.payments.length,
      allocation: cat.allocation
    })));
    
    // Fetch expense transactions for this week
    // Exclude Quick Payment transactions as they're already handled through the budget
    const quickPaymentCategory = await Category.findOne({
      name: 'Quick Payment',
      isSystem: true
    });
    
    // We should NOT add ANY transactions that are already in the budget
    // Quick Payments are added via the /quick endpoint and have transactionId links
    let weekTransactions = [];
    
    // Only fetch non-Quick Payment transactions
    if (quickPaymentCategory) {
      weekTransactions = await Transaction.find({
        userId: req.user._id,
        type: 'expense',
        date: {
          $gte: budget.weekStartDate,
          $lte: budget.weekEndDate
        },
        categoryId: { $ne: quickPaymentCategory._id }
      }).populate('categoryId');
      
      console.log(`Quick Payment category found: ${quickPaymentCategory._id}, excluding from transactions`);
    } else {
      // If no Quick Payment category, get all transactions
      weekTransactions = await Transaction.find({
        userId: req.user._id,
        type: 'expense',
        date: {
          $gte: budget.weekStartDate,
          $lte: budget.weekEndDate
        }
      }).populate('categoryId');
      
      console.log('Quick Payment category not found, including all transactions');
    }

    console.log(`Found ${weekTransactions.length} expense transactions for current week (excluding Quick Payments)`);

    // Convert to plain object to modify
    const enhancedBudget = budget.toObject();
    
    // Create a map of existing payment transaction IDs to avoid duplicates
    const existingTransactionIds = new Set();
    enhancedBudget.categories.forEach(cat => {
      cat.payments.forEach(payment => {
        if (payment.transactionId) {
          existingTransactionIds.add(payment.transactionId.toString());
        }
      });
    });

    console.log('Processing week transactions:', weekTransactions.length);
    console.log('Existing transaction IDs:', Array.from(existingTransactionIds));
    
    // Process each transaction
    weekTransactions.forEach(transaction => {
      // Skip if this transaction is already linked to a payment
      if (existingTransactionIds.has(transaction._id.toString())) {
        console.log('Skipping transaction (already linked):', transaction._id.toString());
        return;
      }
      
      // Double-check: Skip if it's a Quick Payment category (shouldn't happen but safety check)
      if (transaction.categoryId.name === 'Quick Payment' || transaction.categoryId.isSystem) {
        console.log('Skipping Quick Payment transaction that got through filter:', transaction._id.toString());
        return;
      }

      const categoryId = transaction.categoryId._id.toString();
      
      // Find if category exists in budget
      let budgetCategory = enhancedBudget.categories.find(
        cat => cat.categoryId._id.toString() === categoryId
      );

      // If category doesn't exist, add it
      if (!budgetCategory) {
        budgetCategory = {
          categoryId: transaction.categoryId,
          allocation: 0,
          payments: [],
          _id: new mongoose.Types.ObjectId()
        };
        enhancedBudget.categories.push(budgetCategory);
      }

      // Add transaction as a payment
      budgetCategory.payments.push({
        _id: new mongoose.Types.ObjectId(),
        name: transaction.description || `${transaction.categoryId.name} expense`,
        amount: transaction.amount,
        scheduledDate: transaction.date,
        status: 'paid',
        paidDate: transaction.date,
        paidBy: req.user._id,
        notes: `From transaction: ${transaction.paymentMethod || 'N/A'}`,
        transactionId: transaction._id,
        paymentScheduleId: null,
        isFromTransaction: true
      });

      // Update allocation if it's 0
      if (budgetCategory.allocation === 0) {
        const totalPayments = budgetCategory.payments.reduce((sum, p) => sum + p.amount, 0);
        budgetCategory.allocation = totalPayments;
      }
    });

    // Log Quick Payment category specifically
    const quickPaymentCat = enhancedBudget.categories.find(cat => 
      cat.categoryId.name === 'Quick Payment' || cat.categoryId.isSystem
    );
    
    if (quickPaymentCat) {
      console.log('Quick Payment category found in budget:', {
        categoryId: quickPaymentCat.categoryId._id,
        allocation: quickPaymentCat.allocation,
        paymentsCount: quickPaymentCat.payments.length,
        payments: quickPaymentCat.payments.map(p => ({
          name: p.name,
          amount: p.amount,
          transactionId: p.transactionId,
          status: p.status
        }))
      });
    } else {
      console.log('No Quick Payment category in budget');
    }
    
    console.log('Returning enhanced budget:', {
      id: enhancedBudget._id,
      totalBudget: enhancedBudget.totalBudget,
      categoriesCount: enhancedBudget.categories?.length || 0,
      totalPayments: enhancedBudget.categories.reduce((sum, cat) => sum + cat.payments.length, 0),
      weekStart: enhancedBudget.weekStartDate,
      weekEnd: enhancedBudget.weekEndDate
    });
    
    res.json(enhancedBudget);
  } catch (error) {
    console.error('Error fetching current week budget:', error);
    res.status(500).json({ error: 'Failed to fetch current week budget' });
  }
});

// Get budgets by date range (alias for clearer API)
router.get('/range', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    console.log('Fetching budgets for range:', { startDate, endDate, userId: req.user._id });
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    // Find budgets where the week overlaps with the requested range
    const budgets = await WeeklyBudget.find({
      userId: req.user._id,
      $or: [
        // Budget starts within the range
        { 
          weekStartDate: { 
            $gte: new Date(startDate), 
            $lte: new Date(endDate) 
          } 
        },
        // Budget ends within the range
        { 
          weekEndDate: { 
            $gte: new Date(startDate), 
            $lte: new Date(endDate) 
          } 
        },
        // Budget spans the entire range
        {
          weekStartDate: { $lte: new Date(startDate) },
          weekEndDate: { $gte: new Date(endDate) }
        }
      ]
    })
    .populate('categories.categoryId')
    .populate('allocations.categoryId')
    .sort('-weekStartDate');

    console.log(`Found ${budgets.length} budgets for date range`);
    
    // Log categories and payments for debugging
    budgets.forEach(budget => {
      console.log(`Budget ${budget._id}: ${budget.categories?.length || 0} categories`);
      budget.categories?.forEach(cat => {
        console.log(`  Category ${cat.categoryId?.name || 'unknown'}: ${cat.payments?.length || 0} payments`);
      });
    });
    
    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets by range:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

// Get specific weekly budget by ID
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('Fetching weekly budget:', req.params.id, 'for user:', req.user._id);
    
    const budget = await WeeklyBudget.findOne({
      _id: req.params.id,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households || [] } }
      ]
    })
    .populate('categories.categoryId')
    .populate('categories.payments.paidBy', 'name email');
    
    if (!budget) {
      console.log('Budget not found for ID:', req.params.id);
      return res.status(404).json({ error: 'Weekly budget not found' });
    }
    
    // Fetch expense transactions for this week
    // Exclude Quick Payment transactions as they're already handled through the budget
    const quickPaymentCategory = await Category.findOne({
      name: 'Quick Payment',
      isSystem: true
    });
    
    // We should NOT add ANY transactions that are already in the budget
    // Quick Payments are added via the /quick endpoint and have transactionId links
    let weekTransactions = [];
    
    // Only fetch non-Quick Payment transactions
    if (quickPaymentCategory) {
      weekTransactions = await Transaction.find({
        userId: req.user._id,
        type: 'expense',
        date: {
          $gte: budget.weekStartDate,
          $lte: budget.weekEndDate
        },
        categoryId: { $ne: quickPaymentCategory._id }
      }).populate('categoryId');
      
      console.log(`Quick Payment category found: ${quickPaymentCategory._id}, excluding from transactions`);
    } else {
      // If no Quick Payment category, get all transactions
      weekTransactions = await Transaction.find({
        userId: req.user._id,
        type: 'expense',
        date: {
          $gte: budget.weekStartDate,
          $lte: budget.weekEndDate
        }
      }).populate('categoryId');
      
      console.log('Quick Payment category not found, including all transactions');
    }

    console.log(`Found ${weekTransactions.length} expense transactions for week (excluding Quick Payments)`);
    console.log(`Week dates: ${budget.weekStartDate} to ${budget.weekEndDate}`);

    // Convert to plain object to modify
    const enhancedBudget = budget.toObject();
    
    // Create a map of existing payment transaction IDs to avoid duplicates
    const existingTransactionIds = new Set();
    enhancedBudget.categories.forEach(cat => {
      cat.payments.forEach(payment => {
        if (payment.transactionId) {
          existingTransactionIds.add(payment.transactionId.toString());
        }
      });
    });

    console.log('Processing week transactions for budget ID:', weekTransactions.length);
    console.log('Existing transaction IDs in budget:', Array.from(existingTransactionIds));
    
    // Process each transaction
    weekTransactions.forEach(transaction => {
      // Skip if this transaction is already linked to a payment
      if (existingTransactionIds.has(transaction._id.toString())) {
        console.log('Skipping duplicate transaction:', transaction._id);
        return;
      }
      
      // Double-check: Skip if it's a Quick Payment category (shouldn't happen but safety check)
      if (transaction.categoryId.name === 'Quick Payment' || transaction.categoryId.isSystem) {
        console.log('Skipping Quick Payment transaction that got through filter:', transaction._id.toString());
        return;
      }

      const categoryId = transaction.categoryId._id.toString();
      
      // Find if category exists in budget
      let budgetCategory = enhancedBudget.categories.find(
        cat => cat.categoryId._id.toString() === categoryId
      );

      // If category doesn't exist, add it
      if (!budgetCategory) {
        console.log('Adding new category to budget:', transaction.categoryId.name);
        budgetCategory = {
          categoryId: transaction.categoryId,
          allocation: 0,
          payments: [],
          _id: new mongoose.Types.ObjectId()
        };
        enhancedBudget.categories.push(budgetCategory);
      }

      // Add transaction as a payment
      const transactionPayment = {
        _id: new mongoose.Types.ObjectId(),
        name: transaction.description || `${transaction.categoryId.name} expense`,
        amount: transaction.amount,
        scheduledDate: transaction.date,
        status: 'paid',
        paidDate: transaction.date,
        paidBy: req.user._id,
        notes: `From transaction: ${transaction.paymentMethod || 'N/A'}`,
        transactionId: transaction._id,
        paymentScheduleId: null,
        isFromTransaction: true // Flag to identify these are from transactions
      };
      
      budgetCategory.payments.push(transactionPayment);
      console.log('Added transaction as payment:', transactionPayment.name);

      // Update allocation if it's 0
      if (budgetCategory.allocation === 0) {
        const totalPayments = budgetCategory.payments.reduce((sum, p) => sum + p.amount, 0);
        budgetCategory.allocation = totalPayments;
      }
    });

    console.log('Enhanced budget with transactions:', {
      id: enhancedBudget._id,
      categoriesCount: enhancedBudget.categories.length,
      totalPayments: enhancedBudget.categories.reduce((sum, cat) => sum + cat.payments.length, 0)
    });
    
    res.json(enhancedBudget);
  } catch (error) {
    console.error('Error fetching weekly budget:', error);
    res.status(500).json({ error: 'Failed to fetch weekly budget' });
  }
});

// Get budget by date range
router.get('/', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { userId: req.user._id };

    if (startDate && endDate) {
      query.weekStartDate = { $gte: new Date(startDate) };
      query.weekEndDate = { $lte: new Date(endDate) };
    }

    const budgets = await WeeklyBudget.find(query)
      .populate('allocations.categoryId')
      .populate('categories.categoryId')
      .sort('-weekStartDate');

    // Calculate spent amount for each budget
    const budgetsWithSpent = budgets.map(budget => {
      const budgetObj = budget.toObject();
      
      // Calculate total spent from categories and payments
      let totalSpent = 0;
      if (budgetObj.categories && Array.isArray(budgetObj.categories)) {
        budgetObj.categories.forEach(category => {
          if (category.payments && Array.isArray(category.payments)) {
            const categorySpent = category.payments
              .filter(payment => payment.status === 'paid')
              .reduce((sum, payment) => sum + (payment.amount || 0), 0);
            totalSpent += categorySpent;
          }
        });
      }
      
      // Add spent amount and recalculate remaining budget
      budgetObj.totalSpent = totalSpent;
      budgetObj.remainingBudget = budgetObj.totalBudget - totalSpent;
      
      return budgetObj;
    });

    res.json(budgetsWithSpent);
  } catch (error) {
    console.error('Error fetching budgets:', error);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});


// Create or update weekly budget with smart features
router.post('/smart-create', auth, async (req, res) => {
  try {
    console.log('Smart creating budget for user:', req.user._id);
    
    const { 
      weekStartDate, 
      mode = 'manual',
      templateId,
      totalBudget,
      categories = [],
      allocations // backward compatibility
    } = req.body;
    
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    let budget;
    let createdPayments = [];

    // Check if budget already exists
    const existingBudget = await WeeklyBudget.findOne({
      userId: req.user._id,
      weekStartDate: { $lte: startDate },
      weekEndDate: { $gte: startDate }
    });

    if (existingBudget) {
      // Delete the existing budget and its associated payments
      console.log('Deleting existing budget for week:', existingBudget._id);
      
      // Delete associated payment schedules
      await PaymentSchedule.deleteMany({ weeklyBudgetId: existingBudget._id });
      
      // Delete the budget
      await WeeklyBudget.findByIdAndDelete(existingBudget._id);
    }

    // Handle different creation modes
    if (mode === 'template' && templateId) {
      // Create from template
      budget = await WeeklyBudget.createFromTemplate(req.user._id, startDate, templateId);
    } else if (mode === 'smart') {
      // Smart creation based on history
      const insights = await generateBudgetInsights(req.user._id);
      budget = await createSmartBudget(req.user._id, startDate, insights);
    } else {
      // Manual creation
      budget = new WeeklyBudget({
        userId: req.user._id,
        weekStartDate: startDate,
        weekEndDate: endDate,
        totalBudget,
        creationMode: 'manual',
        categories: categories.map(cat => ({
          categoryId: cat.categoryId,
          allocation: cat.allocation,
          payments: []
        })),
        allocations: allocations || [] // backward compatibility
      });
    }

    // Process embedded payments
    if (categories.length > 0) {
      for (const category of categories) {
        if (category.payments && category.payments.length > 0) {
          const budgetCategory = budget.categories.find(
            c => c.categoryId.toString() === category.categoryId
          );

          for (const paymentData of category.payments) {
            // Create PaymentSchedule entry
            const payment = new PaymentSchedule({
              userId: req.user._id,
              name: paymentData.name,
              amount: paymentData.amount,
              categoryId: category.categoryId,
              dueDate: paymentData.scheduledDate,
              frequency: paymentData.isRecurring ? 'monthly' : 'once',
              status: 'pending',
              reminder: { enabled: true, daysBefore: 1 },
              notes: paymentData.notes,
              weeklyBudgetId: budget._id,
              householdId: budget.householdId // Include household ID if budget is shared
            });

            await payment.save();
            createdPayments.push(payment);

            // Add to budget category
            budgetCategory.payments.push({
              name: paymentData.name,
              amount: paymentData.amount,
              scheduledDate: paymentData.scheduledDate,
              status: 'pending',
              paymentScheduleId: payment._id,
              isRecurring: paymentData.isRecurring,
              notes: paymentData.notes
            });
          }
        }
      }
    }

    await budget.save();
    await budget.populate('categories.categoryId allocations.categoryId');
    
    // Generate initial insights
    const insights = await generateBudgetInsights(req.user._id, budget);
    
    res.json({
      budget,
      payments: createdPayments,
      insights
    });
  } catch (error) {
    console.error('Error in smart budget creation:', error);
    res.status(500).json({ error: 'Failed to create budget' });
  }
});

// Original endpoint for backward compatibility
router.post('/', auth, async (req, res) => {
  try {
    console.log('Creating/updating budget for user:', req.user);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: 'User not authenticated properly' });
    }
    
    const { weekStartDate, totalBudget, allocations } = req.body;
    
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    // Check if budget already exists for this week
    let budget = await WeeklyBudget.findOne({
      userId: req.user._id,
      weekStartDate: { $lte: startDate },
      weekEndDate: { $gte: startDate }
    });

    if (budget) {
      // Update existing budget
      budget.totalBudget = totalBudget;
      budget.allocations = allocations || [];
    } else {
      // Create new budget
      budget = new WeeklyBudget({
        userId: req.user._id,
        weekStartDate: startDate,
        weekEndDate: endDate,
        totalBudget,
        allocations: allocations || []
      });
    }

    // Get scheduled payments for this week
    const scheduledPayments = await PaymentSchedule.find({
      userId: req.user._id,
      dueDate: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending', 'overdue'] }
    });

    budget.scheduledPayments = scheduledPayments.map(p => p._id);
    budget.updateRemainingBudget();
    
    await budget.save();
    await budget.populate('allocations.categoryId scheduledPayments');
    
    res.json(budget);
  } catch (error) {
    console.error('Error creating/updating budget:', error);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

// Generate budget insights and recommendations
router.post('/:id/analyze', auth, async (req, res) => {
  try {
    const budget = await WeeklyBudget.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('allocations.categoryId');

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Get transaction history for analysis
    const historicalTransactions = await Transaction.find({
      userId: req.user._id,
      type: 'expense',
      date: {
        $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        $lte: budget.weekEndDate
      }
    });

    // Calculate spending patterns
    const categorySpending = {};
    historicalTransactions.forEach(trans => {
      const categoryId = trans.categoryId.toString();
      if (!categorySpending[categoryId]) {
        categorySpending[categoryId] = {
          total: 0,
          count: 0,
          amounts: []
        };
      }
      categorySpending[categoryId].total += trans.amount;
      categorySpending[categoryId].count += 1;
      categorySpending[categoryId].amounts.push(trans.amount);
    });

    // Generate insights
    const insights = {
      topCategories: [],
      savingsPotential: 0,
      recommendations: [],
      lastAnalyzed: new Date()
    };

    // Find top spending categories
    const sortedCategories = Object.entries(categorySpending)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 5);

    for (const [categoryId, data] of sortedCategories) {
      const category = await Category.findById(categoryId);
      const avgSpending = data.total / data.count;
      const allocation = budget.allocations.find(a => a.categoryId.toString() === categoryId);
      
      insights.topCategories.push({
        categoryId,
        amount: avgSpending,
        percentage: (data.total / historicalTransactions.reduce((sum, t) => sum + t.amount, 0)) * 100
      });

      // Generate recommendations
      if (allocation && allocation.amount < avgSpending * 0.8) {
        insights.recommendations.push(
          `Consider increasing your ${category.name} budget. You typically spend $${avgSpending.toFixed(2)} but only allocated $${allocation.amount}.`
        );
      }

      // Find potential savings
      const amounts = data.amounts.sort((a, b) => a - b);
      const median = amounts[Math.floor(amounts.length / 2)];
      if (avgSpending > median * 1.5) {
        insights.savingsPotential += avgSpending - median;
        insights.recommendations.push(
          `You could save up to $${(avgSpending - median).toFixed(2)} on ${category.name} by avoiding peak spending.`
        );
      }
    }

    // Check for unused allocations
    budget.allocations.forEach(allocation => {
      if (allocation.spent === 0 && allocation.amount > 0) {
        insights.recommendations.push(
          `You haven't used your ${allocation.categoryId.name} budget. Consider reallocating if not needed.`
        );
      }
    });

    // Save insights to budget
    budget.insights = insights;
    await budget.save();

    res.json(insights);
  } catch (error) {
    console.error('Error analyzing budget:', error);
    res.status(500).json({ error: 'Failed to analyze budget' });
  }
});

// Auto-allocate budget based on scheduled payments
router.post('/auto-allocate', auth, async (req, res) => {
  try {
    const { weekStartDate, totalBudget } = req.body;
    
    const startDate = new Date(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // Get scheduled payments for the week
    const scheduledPayments = await PaymentSchedule.find({
      userId: req.user._id,
      dueDate: { $gte: startDate, $lte: endDate },
      status: { $in: ['pending'] }
    }).populate('categoryId');

    // Calculate required amount for scheduled payments
    const categoryAmounts = {};
    let totalRequired = 0;

    scheduledPayments.forEach(payment => {
      const categoryId = payment.categoryId._id.toString();
      if (!categoryAmounts[categoryId]) {
        categoryAmounts[categoryId] = 0;
      }
      categoryAmounts[categoryId] += payment.amount;
      totalRequired += payment.amount;
    });

    // Get historical spending for other categories
    const historicalSpending = await Transaction.aggregate([
      {
        $match: {
          userId: req.user._id,
          type: 'expense',
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      },
      {
        $group: {
          _id: '$categoryId',
          avgAmount: { $avg: '$amount' },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Create allocations
    const allocations = [];
    const remainingBudget = totalBudget - totalRequired;

    // First, add scheduled payment categories
    for (const [categoryId, amount] of Object.entries(categoryAmounts)) {
      allocations.push({
        categoryId,
        amount,
        spent: 0,
        status: 'pending'
      });
    }

    // Then allocate remaining budget to other categories based on historical spending
    if (remainingBudget > 0) {
      const otherCategories = historicalSpending.filter(
        cat => !categoryAmounts[cat._id.toString()]
      );

      const totalHistorical = otherCategories.reduce((sum, cat) => sum + cat.avgAmount, 0);
      
      otherCategories.forEach(cat => {
        const percentage = cat.avgAmount / totalHistorical;
        const allocation = Math.round(remainingBudget * percentage);
        
        if (allocation > 0) {
          allocations.push({
            categoryId: cat._id,
            amount: allocation,
            spent: 0,
            status: 'pending'
          });
        }
      });
    }

    res.json({
      allocations,
      totalRequired,
      remainingBudget,
      scheduledPayments: scheduledPayments.length
    });
  } catch (error) {
    console.error('Error auto-allocating budget:', error);
    res.status(500).json({ error: 'Failed to auto-allocate budget' });
  }
});

// Update allocation status
router.patch('/allocation/:budgetId/:allocationId', auth, async (req, res) => {
  try {
    const { budgetId, allocationId } = req.params;
    const { status } = req.body;

    console.log('Updating allocation status:', { budgetId, allocationId, status, userId: req.user._id });

    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      userId: req.user._id
    }).populate('allocations.categoryId');

    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }

    // Find the allocation
    const allocation = budget.allocations.id(allocationId);
    if (!allocation) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    // Update status
    allocation.status = status;

    // If marking as paid
    if (status === 'paid') {
      allocation.paidDate = new Date();
      
      // Create a transaction for this payment
      const transaction = new Transaction({
        userId: req.user._id,
        description: allocation.name || `Payment for ${allocation.categoryId.name}`,
        amount: allocation.amount,
        type: 'expense',
        categoryId: allocation.categoryId._id,
        date: new Date(),
        weeklyBudgetAllocationId: allocation._id
      });
      
      await transaction.save();
      allocation.transactionId = transaction._id;
      
      // Update spent amount
      allocation.spent = allocation.amount;
      
      // Update remaining budget
      await budget.updateRemainingBudget();
    } else if (status === 'pending' && allocation.transactionId) {
      // If reverting from paid to pending, delete the transaction
      await Transaction.findByIdAndDelete(allocation.transactionId);
      allocation.transactionId = undefined;
      allocation.paidDate = undefined;
      allocation.spent = 0;
      
      // Update remaining budget
      await budget.updateRemainingBudget();
    }

    await budget.save();

    // Populate the updated budget
    const updatedBudget = await WeeklyBudget.findById(budgetId)
      .populate('allocations.categoryId')
      .populate('scheduledPayments');

    res.json(updatedBudget);
  } catch (error) {
    console.error('Error updating allocation status:', error);
    res.status(500).json({ error: 'Failed to update allocation status' });
  }
});

// Get budget history
router.get('/history', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const budgets = await WeeklyBudget.find({
      userId: req.user._id
    })
    .populate('categories.categoryId allocations.categoryId')
    .sort('-weekStartDate')
    .limit(limit);
    
    res.json(budgets);
  } catch (error) {
    console.error('Error fetching budget history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Get budget insights
router.get('/insights', auth, async (req, res) => {
  try {
    const insights = await generateBudgetInsights(req.user._id);
    res.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Update budget total amount
router.patch('/:budgetId', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    const { totalBudget } = req.body;
    
    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households || [] } }
      ]
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Update total budget
    if (totalBudget !== undefined) {
      budget.totalBudget = totalBudget;
      budget.updateRemainingBudget();
    }
    
    await budget.save();
    
    // Update the parent MainBudget if this weekly budget is linked to one
    if (budget.parentBudgetId && totalBudget !== undefined) {
      const MainBudget = require('../models/MainBudget');
      const mainBudget = await MainBudget.findById(budget.parentBudgetId);
      
      if (mainBudget) {
        // Find and update the corresponding week in the weeklyBudgets array
        const weekIndex = mainBudget.weeklyBudgets.findIndex(
          w => w.budgetId && w.budgetId.toString() === budget._id.toString()
        );
        
        if (weekIndex !== -1) {
          mainBudget.weeklyBudgets[weekIndex].allocatedAmount = totalBudget;
          await mainBudget.save();
          console.log(`Updated MainBudget week ${mainBudget.weeklyBudgets[weekIndex].weekNumber} allocatedAmount to ${totalBudget}`);
        }
      }
    }
    
    // Populate and return
    await budget.populate('categories.categoryId');
    await budget.populate('categories.payments.paidBy');
    
    res.json(budget);
  } catch (error) {
    console.error('Error updating budget:', error);
    res.status(500).json({ error: 'Failed to update budget' });
  }
});

// Update budget categories
router.patch('/:budgetId/categories', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    const { categories } = req.body;
    
    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      userId: req.user._id
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Update categories - keeping existing payments
    const existingPaymentsByCategory = new Map();
    budget.categories.forEach(cat => {
      if (cat.payments && cat.payments.length > 0) {
        existingPaymentsByCategory.set(cat.categoryId.toString(), cat.payments);
      }
    });
    
    // Calculate default allocation per category if budget is set
    // Set to 0 to allow unlimited payments per category
    const defaultAllocation = 0;
    console.log(`[weeklyBudget PATCH categories] Setting defaultAllocation to ${defaultAllocation} for flexible budgeting`);
    
    // Set new categories while preserving payments
    budget.categories = categories.map(catId => ({
      categoryId: catId,
      allocation: defaultAllocation,
      payments: existingPaymentsByCategory.get(catId) || []
    }));
    
    await budget.save();
    
    // Populate and return
    await budget.populate('categories.categoryId');
    await budget.populate('categories.payments.paidBy');
    
    res.json(budget);
  } catch (error) {
    console.error('Error updating budget categories:', error);
    res.status(500).json({ error: 'Failed to update categories' });
  }
});

// Add payment to category
router.post('/:budgetId/category/:categoryId/payment', auth, async (req, res) => {
  try {
    const { budgetId, categoryId } = req.params;
    const paymentData = req.body;
    
    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      userId: req.user._id
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Create PaymentSchedule entry
    const payment = new PaymentSchedule({
      userId: req.user._id,
      name: paymentData.name,
      amount: paymentData.amount,
      categoryId,
      dueDate: paymentData.scheduledDate,
      frequency: paymentData.isRecurring ? 'monthly' : 'once',
      status: 'pending',
      reminder: { enabled: true, daysBefore: 1 },
      notes: paymentData.notes,
      weeklyBudgetId: budgetId,
      householdId: budget.householdId // Include household ID if budget is shared
    });
    
    await payment.save();
    
    // Add to budget category
    await budget.addPaymentToCategory(categoryId, {
      name: paymentData.name,
      amount: paymentData.amount,
      scheduledDate: paymentData.scheduledDate,
      status: 'pending',
      paymentScheduleId: payment._id,
      isRecurring: paymentData.isRecurring,
      notes: paymentData.notes
    });
    
    await budget.populate('categories.categoryId');
    
    res.json({
      budget,
      payment
    });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ error: error.message || 'Failed to add payment' });
  }
});

// Update payment status
router.patch('/:budgetId/payment/:paymentId/status', auth, async (req, res) => {
  try {
    const { budgetId, paymentId } = req.params;
    const { status, paidBy } = req.body;
    
    const budget = await WeeklyBudget.findById(budgetId);
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Check permissions - owner or household member
    let hasAccess = budget.userId.equals(req.user._id);
    
    if (!hasAccess && budget.householdId && budget.isSharedWithHousehold) {
      const Household = require('../models/Household');
      const household = await Household.findOne({
        _id: budget.householdId,
        $or: [
          { owner: req.user._id },
          { 'members.user': req.user._id }
        ]
      });
      hasAccess = !!household;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have permission to update this budget' });
    }
    
    // Find and update payment in categories
    let found = false;
    budget.categories.forEach(cat => {
      const payment = cat.payments.find(p => 
        p.paymentScheduleId?.toString() === paymentId ||
        p._id.toString() === paymentId
      );
      
      if (payment) {
        payment.status = status;
        if (status === 'paid') {
          payment.paidDate = new Date();
          payment.paidBy = paidBy || req.user._id;
        } else {
          payment.paidDate = undefined;
          payment.paidBy = undefined;
        }
        found = true;
      }
    });
    
    if (!found) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Find the actual paymentScheduleId from the budget payment
    let actualPaymentScheduleId = null;
    for (const cat of budget.categories) {
      const payment = cat.payments.find(p => 
        p.paymentScheduleId?.toString() === paymentId ||
        p._id.toString() === paymentId
      );
      if (payment) {
        // Use paymentScheduleId if available, otherwise use the paymentId directly
        actualPaymentScheduleId = payment.paymentScheduleId || paymentId;
        break;
      }
    }
    
    await budget.save();
    await budget.populate('categories.categoryId');
    await budget.populate('categories.payments.paidBy', 'name email');
    
    // Also update PaymentSchedule if exists - use the correct ID
    let paymentSchedule = null;
    if (actualPaymentScheduleId) {
      paymentSchedule = await PaymentSchedule.findByIdAndUpdate(actualPaymentScheduleId, { 
        status,
        paidDate: status === 'paid' ? new Date() : undefined,
        paidBy: status === 'paid' ? (paidBy || req.user._id) : undefined
      }, { new: true });
      
      if (paymentSchedule) {
        console.log(`Updated PaymentSchedule ${actualPaymentScheduleId} status to ${status}`);
      } else {
        console.log(`PaymentSchedule ${actualPaymentScheduleId} not found, trying paymentId directly`);
        // Try with the original paymentId
        paymentSchedule = await PaymentSchedule.findByIdAndUpdate(paymentId, { 
          status,
          paidDate: status === 'paid' ? new Date() : undefined,
          paidBy: status === 'paid' ? (paidBy || req.user._id) : undefined
        }, { new: true });
      }
    }

    // Create or delete transaction based on status
    if (status === 'paid') {
      // Use the correct ID for checking existing transaction
      const scheduleIdToCheck = actualPaymentScheduleId || paymentId;
      
      // Check if transaction already exists
      const existingTransaction = await Transaction.findOne({
        $or: [
          { paymentScheduleId: scheduleIdToCheck },
          { paymentScheduleId: paymentId },
          { 'data.budgetPaymentId': paymentId }
        ]
      });

      if (!existingTransaction) {
        // Find the payment details from the budget
        let paymentDetails = null;
        let categoryDetails = null;
        for (const cat of budget.categories) {
          const payment = cat.payments.find(p => 
            p.paymentScheduleId?.toString() === paymentId ||
            p._id.toString() === paymentId
          );
          if (payment) {
            paymentDetails = payment;
            categoryDetails = cat.categoryId;
            break;
          }
        }

        if (paymentDetails) {
          const User = require('../models/User');
          const user = await User.findById(req.user._id);
          
          const transaction = new Transaction({
            userId: req.user._id,
            type: 'expense',
            amount: paymentDetails.amount,
            categoryId: categoryDetails?._id || paymentSchedule?.categoryId,
            description: `Pago: ${paymentDetails.name}`,
            date: new Date(),
            paymentScheduleId: scheduleIdToCheck,
            currency: user?.currency || 'PEN'
          });

          await transaction.save();
          console.log('Transaction created for budget payment:', transaction._id);
        }
      }
    } else {
      // If reverting from paid, delete the transaction
      const scheduleIdToDelete = actualPaymentScheduleId || paymentId;
      const deletedTransaction = await Transaction.findOneAndDelete({
        $or: [
          { paymentScheduleId: scheduleIdToDelete },
          { paymentScheduleId: paymentId },
          { 'data.budgetPaymentId': paymentId }
        ]
      });
      if (deletedTransaction) {
        console.log('Deleted transaction for reverted payment:', deletedTransaction._id);
      }
    }
    
    res.json(budget);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment' });
  }
});

// Delete category from budget
router.delete('/:budgetId/category/:categoryId', auth, async (req, res) => {
  try {
    const { budgetId, categoryId } = req.params;
    
    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      userId: req.user._id
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Find the category
    const categoryIndex = budget.categories.findIndex(cat => 
      cat.categoryId.toString() === categoryId ||
      cat._id.toString() === categoryId
    );
    
    if (categoryIndex === -1) {
      return res.status(404).json({ error: 'Category not found in budget' });
    }
    
    // Delete associated payment schedules
    const category = budget.categories[categoryIndex];
    for (const payment of category.payments) {
      if (payment.paymentScheduleId) {
        await PaymentSchedule.findByIdAndDelete(payment.paymentScheduleId);
      }
    }
    
    // Remove category from budget
    budget.categories.splice(categoryIndex, 1);
    
    await budget.save();
    await budget.populate('categories.categoryId allocations.categoryId');
    
    res.json(budget);
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

// Delete payment from category
router.delete('/:budgetId/category/:categoryId/payment/:paymentId', auth, async (req, res) => {
  try {
    const { budgetId, categoryId, paymentId } = req.params;
    
    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      userId: req.user._id
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Find the category
    const category = budget.categories.find(cat => 
      cat.categoryId.toString() === categoryId ||
      cat._id.toString() === categoryId
    );
    
    if (!category) {
      return res.status(404).json({ error: 'Category not found in budget' });
    }
    
    // Find and remove payment
    const paymentIndex = category.payments.findIndex(p => 
      p.paymentScheduleId?.toString() === paymentId ||
      p._id.toString() === paymentId
    );
    
    if (paymentIndex === -1) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const payment = category.payments[paymentIndex];
    
    // Delete from PaymentSchedule collection if exists
    if (payment.paymentScheduleId) {
      await PaymentSchedule.findByIdAndDelete(payment.paymentScheduleId);
    }
    
    // Remove payment from category
    category.payments.splice(paymentIndex, 1);
    
    await budget.save();
    await budget.populate('categories.categoryId');
    
    res.json(budget);
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// Toggle budget sharing with household
router.patch('/:id/share', auth, async (req, res) => {
  try {
    const { isShared, householdId } = req.body;
    console.log('Share budget request:', { budgetId: req.params.id, isShared, householdId });
    
    const budget = await WeeklyBudget.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // If sharing, verify user belongs to the household and set householdId
    if (isShared && householdId) {
      const Household = require('../models/Household');
      const household = await Household.findOne({
        _id: householdId,
        $or: [
          { createdBy: req.user._id },
          { 'members.user': req.user._id }
        ]
      });
      
      if (!household) {
        return res.status(403).json({ error: 'You are not a member of this household' });
      }
      
      budget.householdId = householdId;
      budget.isSharedWithHousehold = true;
    } else {
      // If not sharing, clear the householdId
      budget.householdId = undefined;
      budget.isSharedWithHousehold = false;
    }
    
    await budget.save();
    
    await budget.populate('categories.categoryId allocations.categoryId');
    
    res.json(budget);
  } catch (error) {
    console.error('Error updating budget sharing:', error);
    res.status(500).json({ error: 'Failed to update budget sharing' });
  }
});

// Get household shared budgets
router.get('/household/:householdId', auth, async (req, res) => {
  try {
    const { householdId } = req.params;
    console.log('Fetching household budgets for:', householdId, 'User:', req.user._id);
    
    // Verify user belongs to the household
    const Household = require('../models/Household');
    const household = await Household.findOne({
      _id: householdId,
      $or: [
        { createdBy: req.user._id },
        { 'members.user': req.user._id }
      ]
    });
    
    if (!household) {
      console.log('User not member of household');
      return res.status(403).json({ error: 'You are not a member of this household' });
    }
    
    console.log('Household structure:', {
      createdBy: household.createdBy,
      members: household.members,
      memberCount: household.members ? household.members.length : 0
    });
    
    // Get all shared budgets from household members
    const memberIds = [];
    if (household.createdBy) {
      memberIds.push(household.createdBy);
    }
    household.members.forEach(m => {
      if (m && m.user) {
        memberIds.push(m.user);
      }
    });
    console.log('Household members:', memberIds.map(id => id ? id.toString() : 'null'));
    
    // First, let's check all budgets for these users
    const allUserBudgets = await WeeklyBudget.find({
      userId: { $in: memberIds }
    }).select('_id userId householdId isSharedWithHousehold weekStartDate');
    
    console.log('All budgets from household members:', JSON.stringify(allUserBudgets.map(b => ({
      _id: b._id,
      userId: b.userId,
      householdId: b.householdId,
      isSharedWithHousehold: b.isSharedWithHousehold,
      weekStartDate: b.weekStartDate
    })), null, 2));
    
    // Get shared budgets
    const sharedBudgets = await WeeklyBudget.find({
      householdId: householdId,
      isSharedWithHousehold: true,
      userId: { $in: memberIds }
    })
    .populate('userId', 'name email')
    .populate('categories.categoryId')
    .populate('categories.payments.paidBy', 'name email')
    .populate('allocations.categoryId')
    .sort('-weekStartDate');
    
    console.log('Found shared budgets:', sharedBudgets.length);
    
    // Sync payments from PaymentSchedule to categories
    for (const budget of sharedBudgets) {
      try {
        // Check if we should sync (empty categories or force refresh)
        const forceRefresh = req.query.refresh === 'true';
        const needsSync = !budget.categories || budget.categories.length === 0 || forceRefresh;
        
        console.log(`Budget ${budget._id} sync check:`, {
          hasCategories: !!budget.categories,
          categoriesLength: budget.categories?.length,
          forceRefresh,
          needsSync
        });
        
        // IMPORTANT: Do NOT sync if budget already has categories with payments
        // This preserves the payment statuses that were set in the original budget
        if (needsSync && budget._id && (!budget.categories || budget.categories.length === 0)) {
          console.log(`Syncing categories for budget ${budget._id}`);
          
          // Get payments from PaymentSchedule model with dueDate
          const budgetUserId = budget.userId._id || budget.userId;
          
          const payments = await PaymentSchedule.find({
            userId: budgetUserId,
            dueDate: {
              $gte: budget.weekStartDate,
              $lte: budget.weekEndDate
            }
          }).populate('categoryId')
            .populate('paidBy', 'name email');
          
          console.log(`Found ${payments.length} payments for budget ${budget._id}`);
          
          if (payments.length > 0) {
            // Group payments by category
            const categoryMap = new Map();
            
            payments.forEach(payment => {
              if (!payment.categoryId) {
                console.log('Payment without category:', payment.name);
                return;
              }
              
              const catId = payment.categoryId._id.toString();
              if (!categoryMap.has(catId)) {
                categoryMap.set(catId, {
                  categoryId: payment.categoryId._id, // Store just the ID
                  allocation: 0,
                  payments: []
                });
              }
              
              const category = categoryMap.get(catId);
            category.allocation += payment.amount;
            const paymentData = {
              _id: payment._id,
              name: payment.name,
              amount: payment.amount,
              status: payment.status,
              scheduledDate: payment.dueDate, // Map dueDate to scheduledDate
              paidDate: payment.paidDate,
              paidBy: payment.paidBy,
              paymentScheduleId: payment._id,
              notes: payment.notes
            };
            
            // Log paidBy data
            if (payment.status === 'paid') {
              console.log('Syncing paid payment:', {
                name: payment.name,
                paidBy: payment.paidBy,
                paidByType: typeof payment.paidBy
              });
            }
            
            category.payments.push(paymentData);
            });
            
            // Update budget with categories
            budget.categories = Array.from(categoryMap.values());
            await budget.save();
            console.log(`Updated budget with ${budget.categories.length} categories`);
            
            // Link payments to this budget for future updates
            await PaymentSchedule.updateMany(
              {
                _id: { $in: payments.map(p => p._id) },
                weeklyBudgetId: { $exists: false }
              },
              {
                $set: { weeklyBudgetId: budget._id }
              }
            );
          }
        }
      } catch (syncError) {
        console.error(`Error syncing budget ${budget._id}:`, syncError);
      }
    }
    
    // Re-populate after updates with deep population
    if (sharedBudgets.length > 0) {
      const populatedBudgets = await WeeklyBudget.populate(sharedBudgets, [
        { path: 'userId', select: 'name email' },
        { path: 'categories.categoryId', select: 'name color icon' },
        { path: 'categories.payments.paidBy', select: '_id name email' },
        { path: 'allocations.categoryId', select: 'name color icon' }
      ]);
      
      // Log to check paidBy population
      if (populatedBudgets.length > 0 && populatedBudgets[0].categories.length > 0) {
        const firstPayment = populatedBudgets[0].categories[0].payments.find(p => p.paidBy);
        if (firstPayment) {
          console.log('Sample populated paidBy:', firstPayment.paidBy);
        }
      }
    }
    
    // Log final state
    if (sharedBudgets.length > 0) {
      console.log('First budget after sync:', {
        hasCategories: !!sharedBudgets[0].categories,
        categoriesLength: sharedBudgets[0].categories?.length,
        firstCategory: sharedBudgets[0].categories?.[0]
      });
    }
    
    res.json(sharedBudgets);
  } catch (error) {
    console.error('Error fetching household budgets:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    res.status(500).json({ 
      error: 'Failed to fetch household budgets', 
      details: error.message 
    });
  }
});

// Sync categories for a specific budget
router.post('/:budgetId/sync-categories', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    
    const budget = await WeeklyBudget.findById(budgetId).populate('userId');
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    console.log('Budget found:', {
      _id: budget._id,
      userId: budget.userId,
      userIdType: typeof budget.userId,
      reqUserId: req.user._id,
      householdId: budget.householdId,
      isSharedWithHousehold: budget.isSharedWithHousehold
    });
    
    // Check if user has access (either owner or household member)
    let hasAccess = false;
    
    try {
      // Handle both populated and non-populated userId
      const budgetUserId = budget.userId._id || budget.userId;
      hasAccess = budgetUserId && budgetUserId.toString() === req.user._id.toString();
    } catch (err) {
      console.error('Error comparing user IDs:', err);
    }
    
    if (!hasAccess && budget.householdId && budget.isSharedWithHousehold) {
      const Household = require('../models/Household');
      const household = await Household.findOne({
        _id: budget.householdId,
        $or: [
          { createdBy: req.user._id },
          { 'members.user': req.user._id }
        ]
      });
      hasAccess = !!household;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    console.log(`Starting sync for budget ${budgetId}`);
    console.log('Budget details:', {
      _id: budget._id,
      userId: budget.userId,
      weekStartDate: budget.weekStartDate,
      weekEndDate: budget.weekEndDate,
      currentCategories: budget.categories?.length || 0
    });
    
    // Get payments from PaymentSchedule model with dueDate
    const queryUserId = budget.userId._id || budget.userId;
    
    console.log('Searching for payments in week range...');
    const payments = await PaymentSchedule.find({
      userId: queryUserId,
      dueDate: {
        $gte: budget.weekStartDate,
        $lte: budget.weekEndDate
      }
    }).populate('categoryId')
      .populate('paidBy', 'name email');
    
    console.log(`Found ${payments.length} payments for budget week`);
    
    if (payments.length === 0) {
      return res.json({
        message: 'No payments found for this budget week',
        categoriesCount: 0,
        budget
      });
    }
    
    // Group payments by category
    const categoryMap = new Map();
    
    payments.forEach(payment => {
      if (!payment.categoryId) {
        console.log('Skipping payment without category:', payment.name);
        return;
      }
      
      console.log('Processing payment:', {
        name: payment.name,
        amount: payment.amount,
        categoryName: payment.categoryId.name
      });
      
      const catId = payment.categoryId._id.toString();
      if (!categoryMap.has(catId)) {
        categoryMap.set(catId, {
          categoryId: payment.categoryId._id, // Store just the ID
          allocation: 0,
          payments: []
        });
      }
      
      const category = categoryMap.get(catId);
      category.allocation += payment.amount;
      const paymentData = {
        _id: payment._id,
        name: payment.name,
        amount: payment.amount,
        status: payment.status,
        scheduledDate: payment.dueDate, // Map dueDate to scheduledDate for consistency
        paidDate: payment.paidDate,
        paidBy: payment.paidBy,
        paymentScheduleId: payment._id,
        notes: payment.notes
      };
      
      // Log paidBy data for debugging
      if (payment.status === 'paid') {
        console.log('Sync categories - paid payment:', {
          name: payment.name,
          paidBy: payment.paidBy,
          paidByType: typeof payment.paidBy,
          paidByPopulated: payment.populated && payment.populated('paidBy')
        });
      }
      
      category.payments.push(paymentData);
    });
    
    // Update budget with categories
    budget.categories = Array.from(categoryMap.values());
    await budget.save();
    
    // Link payments to this budget for future updates
    await PaymentSchedule.updateMany(
      {
        _id: { $in: payments.map(p => p._id) },
        weeklyBudgetId: { $exists: false }
      },
      {
        $set: { weeklyBudgetId: budget._id }
      }
    );
    
    // Populate and return
    await budget.populate([
      { path: 'categories.categoryId', select: 'name color icon' },
      { path: 'categories.payments.paidBy', select: 'name email' }
    ]);
    
    res.json({
      message: 'Categories synced successfully',
      categoriesCount: budget.categories.length,
      budget
    });
  } catch (error) {
    console.error('Error syncing categories:', error);
    console.error('Error details:', error.stack);
    res.status(500).json({ 
      error: 'Failed to sync categories',
      details: error.message 
    });
  }
});

// Diagnostic endpoint to check payments for a budget
router.get('/:budgetId/check-payments', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    
    const budget = await WeeklyBudget.findById(budgetId);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Check all payments for this user
    const allUserPayments = await PaymentSchedule.find({
      userId: budget.userId
    }).populate('categoryId').sort('dueDate');
    
    // Check payments with weeklyBudgetId
    const linkedPayments = await PaymentSchedule.find({
      weeklyBudgetId: budget._id
    }).populate('categoryId');
    
    // Check payments in date range
    const weekPayments = await PaymentSchedule.find({
      userId: budget.userId,
      dueDate: {
        $gte: budget.weekStartDate,
        $lte: budget.weekEndDate
      }
    }).populate('categoryId');
    
    res.json({
      budget: {
        _id: budget._id,
        userId: budget.userId,
        weekStartDate: budget.weekStartDate,
        weekEndDate: budget.weekEndDate,
        categories: budget.categories?.length || 0
      },
      totalUserPayments: allUserPayments.length,
      linkedPayments: linkedPayments.length,
      weekPayments: weekPayments.length,
      weekPaymentDetails: weekPayments.map(p => ({
        _id: p._id,
        name: p.name,
        amount: p.amount,
        dueDate: p.dueDate,
        categoryId: p.categoryId?._id,
        categoryName: p.categoryId?.name,
        status: p.status
      })),
      recentPayments: allUserPayments.slice(0, 5).map(p => ({
        name: p.name,
        dueDate: p.dueDate,
        categoryName: p.categoryId?.name
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix payment links for a budget
router.post('/:budgetId/fix-payment-links', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    
    const budget = await WeeklyBudget.findById(budgetId);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Check access
    let hasAccess = budget.userId.toString() === req.user._id.toString();
    if (!hasAccess && budget.householdId && budget.isSharedWithHousehold) {
      const Household = require('../models/Household');
      const household = await Household.findOne({
        _id: budget.householdId,
        $or: [
          { createdBy: req.user._id },
          { 'members.user': req.user._id }
        ]
      });
      hasAccess = !!household;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get all payment IDs from the budget categories
    const paymentIds = [];
    budget.categories.forEach(cat => {
      cat.payments.forEach(p => {
        if (p._id || p.paymentScheduleId) {
          paymentIds.push(p.paymentScheduleId || p._id);
        }
      });
    });
    
    console.log(`Fixing links for ${paymentIds.length} payments`);
    
    // Update PaymentSchedule to link to this budget and household
    const updateData = { weeklyBudgetId: budget._id };
    if (budget.householdId && budget.isSharedWithHousehold) {
      updateData.householdId = budget.householdId;
    }
    
    const result = await PaymentSchedule.updateMany(
      {
        _id: { $in: paymentIds },
        $or: [
          { weeklyBudgetId: { $exists: false } },
          { weeklyBudgetId: null }
        ]
      },
      {
        $set: updateData
      }
    );
    
    // Also fix householdId for payments that already have weeklyBudgetId
    if (budget.householdId && budget.isSharedWithHousehold) {
      const householdResult = await PaymentSchedule.updateMany(
        {
          _id: { $in: paymentIds },
          weeklyBudgetId: budget._id,
          $or: [
            { householdId: { $exists: false } },
            { householdId: null }
          ]
        },
        {
          $set: { householdId: budget.householdId }
        }
      );
      
      console.log(`Updated householdId for ${householdResult.modifiedCount} payments`);
    }
    
    res.json({
      message: 'Payment links fixed',
      paymentsInBudget: paymentIds.length,
      paymentsUpdated: result.modifiedCount
    });
  } catch (error) {
    console.error('Error fixing payment links:', error);
    res.status(500).json({ error: 'Failed to fix payment links' });
  }
});

// Debug payment sync status
router.get('/:budgetId/debug-sync', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    
    const budget = await WeeklyBudget.findById(budgetId);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Get all payment IDs from budget
    const budgetPaymentIds = [];
    budget.categories.forEach(cat => {
      cat.payments.forEach(p => {
        budgetPaymentIds.push({
          name: p.name,
          _id: p._id?.toString(),
          paymentScheduleId: p.paymentScheduleId?.toString(),
          status: p.status
        });
      });
    });
    
    // Check PaymentSchedule documents
    const paymentSchedules = await PaymentSchedule.find({
      _id: { $in: budgetPaymentIds.map(p => p.paymentScheduleId || p._id) }
    });
    
    const paymentStatus = paymentSchedules.map(ps => ({
      _id: ps._id.toString(),
      name: ps.name,
      status: ps.status,
      weeklyBudgetId: ps.weeklyBudgetId?.toString(),
      hasCorrectBudgetId: ps.weeklyBudgetId?.toString() === budgetId
    }));
    
    res.json({
      budgetId: budget._id,
      budgetPayments: budgetPaymentIds,
      paymentScheduleStatus: paymentStatus,
      syncIssues: paymentStatus.filter(p => !p.hasCorrectBudgetId).length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to check data
router.get('/test/household-data/:householdId', auth, async (req, res) => {
  try {
    const { householdId } = req.params;
    
    // Get all budgets
    const allBudgets = await WeeklyBudget.find({}).select('_id userId householdId isSharedWithHousehold').limit(10);
    
    // Get specific household budgets
    const householdBudgets = await WeeklyBudget.find({ householdId: householdId });
    
    res.json({
      allBudgetsCount: await WeeklyBudget.countDocuments(),
      sampleBudgets: allBudgets,
      householdBudgetsCount: householdBudgets.length,
      householdBudgets: householdBudgets.map(b => ({
        _id: b._id,
        userId: b.userId,
        householdId: b.householdId,
        isSharedWithHousehold: b.isSharedWithHousehold
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix paidBy data in budget
router.post('/:budgetId/fix-paidby', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    
    const budget = await WeeklyBudget.findById(budgetId);
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Check access
    let hasAccess = budget.userId.toString() === req.user._id.toString();
    if (!hasAccess && budget.householdId && budget.isSharedWithHousehold) {
      const Household = require('../models/Household');
      const household = await Household.findOne({
        _id: budget.householdId,
        $or: [
          { createdBy: req.user._id },
          { 'members.user': req.user._id }
        ]
      });
      hasAccess = !!household;
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const PaymentSchedule = require('../models/PaymentSchedule');
    let fixedCount = 0;
    
    // Fix each payment's paidBy
    for (let catIndex = 0; catIndex < budget.categories.length; catIndex++) {
      const category = budget.categories[catIndex];
      for (let payIndex = 0; payIndex < category.payments.length; payIndex++) {
        const payment = category.payments[payIndex];
        
        if (payment.status === 'paid' && payment.paidBy && typeof payment.paidBy !== 'object') {
          // Get the corresponding PaymentSchedule
          const schedulePayment = await PaymentSchedule.findById(payment.paymentScheduleId || payment._id)
            .populate('paidBy', 'name email');
          
          if (schedulePayment && schedulePayment.paidBy) {
            // Update the payment in the budget with the populated data
            budget.categories[catIndex].payments[payIndex].paidBy = schedulePayment.paidBy._id;
            fixedCount++;
            
            console.log(`Fixed paidBy for payment: ${payment.name}`);
          }
        }
      }
    }
    
    if (fixedCount > 0) {
      budget.markModified('categories');
      await budget.save();
    }
    
    // Re-fetch with proper population
    const updatedBudget = await WeeklyBudget.findById(budgetId)
      .populate('userId', 'name email')
      .populate('categories.categoryId', 'name color icon')
      .populate('categories.payments.paidBy', 'name email');
    
    res.json({
      message: `Fixed ${fixedCount} payments`,
      budget: updatedBudget
    });
  } catch (error) {
    console.error('Error fixing paidBy:', error);
    res.status(500).json({ error: error.message });
  }
});

// Diagnostic endpoint to check paidBy data
router.get('/:budgetId/check-paidby', auth, async (req, res) => {
  try {
    const { budgetId } = req.params;
    
    // Get budget with populated data
    const budget = await WeeklyBudget.findById(budgetId)
      .populate('userId', 'name email')
      .populate('categories.categoryId', 'name')
      .populate('categories.payments.paidBy', 'name email');
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Check payments with paidBy
    const paymentsWithPaidBy = [];
    budget.categories.forEach(cat => {
      cat.payments.forEach(p => {
        if (p.paidBy) {
          paymentsWithPaidBy.push({
            name: p.name,
            status: p.status,
            paidBy: p.paidBy,
            paidByType: typeof p.paidBy,
            paidByIsObject: p.paidBy && typeof p.paidBy === 'object',
            paidByHasName: p.paidBy && p.paidBy.name ? true : false
          });
        }
      });
    });
    
    // Also check PaymentSchedule directly
    const paymentIds = budget.categories.flatMap(cat => 
      cat.payments.map(p => p.paymentScheduleId || p._id)
    );
    
    const PaymentSchedule = require('../models/PaymentSchedule');
    const schedulePayments = await PaymentSchedule.find({
      _id: { $in: paymentIds }
    }).populate('paidBy', 'name email');
    
    res.json({
      budgetId: budget._id,
      budgetPayments: paymentsWithPaidBy,
      schedulePayments: schedulePayments.map(p => ({
        name: p.name,
        status: p.status,
        paidBy: p.paidBy,
        paidByType: typeof p.paidBy
      }))
    });
  } catch (error) {
    console.error('Error checking paidBy:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update payment in weekly budget
router.patch('/:budgetId/payment/:paymentId', auth, async (req, res) => {
  try {
    const { budgetId, paymentId } = req.params;
    const { status, paidBy, name, amount, scheduledDate, notes, categoryId } = req.body;
    
    console.log(`[Payment Update] Starting update for payment ${paymentId} in budget ${budgetId}`);
    console.log(`[Payment Update] Request body:`, req.body);
    
    // Use findById with lean for better performance on initial check
    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households || [] } }
      ]
    });
    
    if (!budget) {
      console.log(`[Payment Update] Budget ${budgetId} not found`);
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // Find and update the payment in categories
    let paymentFound = false;
    let oldCategoryId = null;
    
    for (const category of budget.categories) {
      const paymentIndex = category.payments.findIndex(p => 
        p._id.toString() === paymentId || 
        p.paymentScheduleId?.toString() === paymentId
      );
      
      if (paymentIndex !== -1) {
        oldCategoryId = category.categoryId;
        
        // If category is changing, remove from old category
        if (categoryId && categoryId !== category.categoryId.toString()) {
          category.payments.splice(paymentIndex, 1);
          
          // Add to new category
          const newCategory = budget.categories.find(c => c.categoryId.toString() === categoryId);
          if (newCategory) {
            newCategory.payments.push({
              ...category.payments[paymentIndex],
              name: name || category.payments[paymentIndex].name,
              amount: amount !== undefined ? amount : category.payments[paymentIndex].amount,
              scheduledDate: scheduledDate || category.payments[paymentIndex].scheduledDate,
              notes: notes !== undefined ? notes : category.payments[paymentIndex].notes
            });
          }
        } else {
          // Update payment in place
          if (name !== undefined) category.payments[paymentIndex].name = name;
          if (amount !== undefined) category.payments[paymentIndex].amount = amount;
          if (scheduledDate !== undefined) category.payments[paymentIndex].scheduledDate = scheduledDate;
          if (notes !== undefined) category.payments[paymentIndex].notes = notes;
          if (status !== undefined) category.payments[paymentIndex].status = status;
          
          // If marking as paid, set paidBy
          if (status === 'paid' && paidBy) {
            category.payments[paymentIndex].paidBy = paidBy;
          }
        }
        
        paymentFound = true;
        break;
      }
    }
    
    if (!paymentFound) {
      return res.status(404).json({ error: 'Payment not found in budget' });
    }
    
    // Update remaining budget
    try {
      budget.updateRemainingBudget();
    } catch (updateError) {
      console.error('[Payment Update] Error updating remaining budget:', updateError);
      // Continue even if remaining budget update fails
    }
    
    // Save with retry logic for concurrent updates
    let retryCount = 0;
    const maxRetries = 3;
    let saved = false;
    
    while (!saved && retryCount < maxRetries) {
      try {
        await budget.save();
        saved = true;
        console.log(`[Payment Update] Successfully saved budget after ${retryCount + 1} attempt(s)`);
      } catch (saveError) {
        retryCount++;
        console.error(`[Payment Update] Save attempt ${retryCount} failed:`, saveError.message);
        
        if (retryCount >= maxRetries) {
          throw saveError;
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        
        // Reload the budget and try again
        const freshBudget = await WeeklyBudget.findById(budgetId);
        if (!freshBudget) {
          throw new Error('Budget no longer exists');
        }
        
        // Reapply the changes
        for (const category of freshBudget.categories) {
          const payment = category.payments.find(p => 
            p._id.toString() === paymentId || 
            p.paymentScheduleId?.toString() === paymentId
          );
          
          if (payment) {
            if (name !== undefined) payment.name = name;
            if (amount !== undefined) payment.amount = amount;
            if (scheduledDate !== undefined) payment.scheduledDate = scheduledDate;
            if (notes !== undefined) payment.notes = notes;
            if (status !== undefined) payment.status = status;
            if (status === 'paid' && paidBy) payment.paidBy = paidBy;
            break;
          }
        }
        
        budget = freshBudget;
      }
    }
    
    // Populate and return
    await budget.populate('categories.categoryId');
    await budget.populate('categories.payments.paidBy', 'name email');

    // IMPORTANT: Also update PaymentSchedule if this payment is linked to one
    // Find the payment to get its paymentScheduleId
    let linkedPaymentScheduleId = null;
    for (const cat of budget.categories) {
      const payment = cat.payments.find(p => 
        p._id.toString() === paymentId || 
        p.paymentScheduleId?.toString() === paymentId
      );
      if (payment) {
        linkedPaymentScheduleId = payment.paymentScheduleId || null;
        // Also check if paymentId itself is a PaymentSchedule ID
        if (!linkedPaymentScheduleId) {
          const existingSchedule = await PaymentSchedule.findById(paymentId);
          if (existingSchedule) {
            linkedPaymentScheduleId = paymentId;
          }
        }
        break;
      }
    }

    // Update PaymentSchedule if exists
    if (linkedPaymentScheduleId) {
      const updateData = {};
      if (status !== undefined) updateData.status = status;
      if (name !== undefined) updateData.name = name;
      if (amount !== undefined) updateData.amount = amount;
      if (scheduledDate !== undefined) updateData.dueDate = scheduledDate;
      if (notes !== undefined) updateData.notes = notes;
      if (status === 'paid') {
        updateData.paidDate = new Date();
        updateData.paidBy = paidBy || req.user._id;
      } else if (status !== undefined) {
        updateData.paidDate = null;
        updateData.paidBy = null;
      }

      const updatedSchedule = await PaymentSchedule.findByIdAndUpdate(
        linkedPaymentScheduleId,
        updateData,
        { new: true }
      );
      
      if (updatedSchedule) {
        console.log(`[Payment Update] Also updated PaymentSchedule ${linkedPaymentScheduleId} - status: ${status}`);
      } else {
        console.log(`[Payment Update] PaymentSchedule ${linkedPaymentScheduleId} not found for sync`);
      }
    } else {
      console.log(`[Payment Update] No linked PaymentSchedule found for payment ${paymentId}`);
    }

    // Create or delete transaction based on status change
    if (status === 'paid') {
      // Check if transaction already exists
      const existingTransaction = await Transaction.findOne({
        $or: [
          { paymentScheduleId: paymentId },
          { 'data.budgetPaymentId': paymentId }
        ]
      });

      if (!existingTransaction) {
        // Find the payment details from the budget
        let paymentDetails = null;
        let categoryDetails = null;
        for (const cat of budget.categories) {
          const payment = cat.payments.find(p => 
            p.paymentScheduleId?.toString() === paymentId ||
            p._id.toString() === paymentId
          );
          if (payment) {
            paymentDetails = payment;
            categoryDetails = cat.categoryId;
            break;
          }
        }

        if (paymentDetails) {
          const User = require('../models/User');
          const user = await User.findById(req.user._id);
          
          const transaction = new Transaction({
            userId: req.user._id,
            type: 'expense',
            amount: paymentDetails.amount || amount,
            categoryId: categoryDetails?._id,
            description: `Pago: ${paymentDetails.name || name}`,
            date: new Date(),
            paymentScheduleId: paymentDetails.paymentScheduleId || null,
            currency: user?.currency || 'PEN'
          });

          await transaction.save();
          console.log('[Payment Update] Transaction created:', transaction._id);
        }
      }
    } else if (status !== undefined && status !== 'paid') {
      // If status changed to non-paid, delete any existing transaction
      const deletedTransaction = await Transaction.findOneAndDelete({
        $or: [
          { paymentScheduleId: paymentId },
          { 'data.budgetPaymentId': paymentId }
        ]
      });
      if (deletedTransaction) {
        console.log('[Payment Update] Deleted transaction:', deletedTransaction._id);
      }
    }
    
    console.log(`[Payment Update] Successfully completed update for payment ${paymentId}`);
    res.json(budget);
  } catch (error) {
    console.error('[Payment Update] Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status: ' + error.message });
  }
});

// Delete payment from weekly budget
router.delete('/:budgetId/payment/:paymentId', auth, async (req, res) => {
  try {
    const { budgetId, paymentId } = req.params;
    
    const budget = await WeeklyBudget.findOne({
      _id: budgetId,
      $or: [
        { userId: req.user._id },
        { householdId: { $in: req.user.households || [] } }
      ]
    });
    
    if (!budget) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    
    // First, check if this is a transaction-based payment that only exists in the frontend
    // These payments are added dynamically and don't exist in the database
    let transactionDeleted = false;
    
    // Try to find a matching transaction by checking if paymentId matches a transaction ID
    const Transaction = require('../models/Transaction');
    try {
      const transaction = await Transaction.findOne({
        _id: paymentId,
        userId: req.user._id
      });
      
      if (transaction) {
        // This is actually a transaction ID, not a payment ID
        // Delete the transaction itself
        await Transaction.findByIdAndDelete(paymentId);
        transactionDeleted = true;
        
        return res.json({ 
          message: 'Transaction deleted successfully',
          deletedTransaction: true 
        });
      }
    } catch (e) {
      // paymentId might not be a valid ObjectId for transactions
      console.log('Not a transaction ID:', paymentId);
    }
    
    // If not a transaction, try to find and remove the payment from categories
    let paymentFound = false;
    let deletedPayment = null;
    
    for (const category of budget.categories) {
      const paymentIndex = category.payments.findIndex(p => 
        p._id.toString() === paymentId || 
        p.paymentScheduleId?.toString() === paymentId
      );
      
      if (paymentIndex !== -1) {
        deletedPayment = category.payments[paymentIndex];
        
        // If this payment has a transactionId, delete the transaction
        if (deletedPayment.transactionId) {
          await Transaction.findByIdAndDelete(deletedPayment.transactionId);
        }
        
        category.payments.splice(paymentIndex, 1);
        paymentFound = true;
        break;
      }
    }
    
    if (!paymentFound && !transactionDeleted) {
      return res.status(404).json({ error: 'Payment not found in budget' });
    }
    
    // Update remaining budget
    budget.updateRemainingBudget();
    await budget.save();
    
    res.json({ 
      message: 'Payment deleted successfully',
      hadTransaction: !!deletedPayment?.transactionId || transactionDeleted
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

// Create quick monthly budget with weekly breakdown
router.post('/quick-monthly', auth, async (req, res) => {
  try {
    const { monthlyIncome, createFullMonth = false } = req.body;
    
    // If createFullMonth is true, create weekly budgets for the entire month
    if (createFullMonth) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Get all categories
      const Category = require('../models/Category');
      const categories = await Category.find({
        $or: [
          { userId: null, type: 'expense' },
          { userId: req.user._id, type: 'expense' }
        ]
      });
      
      const createdBudgets = [];
      
      // Find all Mondays in the month
      const weeks = [];
      
      // Start from the Monday of the week containing the 1st
      const firstOfMonth = new Date(monthStart);
      const firstDayOfWeek = firstOfMonth.getDay();
      const daysUntilMonday = firstDayOfWeek === 0 ? -6 : 1 - firstDayOfWeek;
      
      let currentMonday = new Date(firstOfMonth);
      currentMonday.setDate(firstOfMonth.getDate() + daysUntilMonday);
      currentMonday.setHours(0, 0, 0, 0);
      
      console.log('Month:', format(monthStart, 'MMMM yyyy'));
      console.log('First Monday of month period:', format(currentMonday, 'yyyy-MM-dd'));
      
      // Find all weeks that touch the current month
      while (currentMonday <= monthEnd || (currentMonday <= monthStart && new Date(currentMonday).setDate(currentMonday.getDate() + 6) >= monthStart)) {
        const weekStart = new Date(currentMonday);
        const weekEnd = new Date(currentMonday);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        // Only include weeks that overlap with the month
        if (weekEnd >= monthStart && weekStart <= monthEnd) {
          weeks.push({ start: new Date(weekStart), end: new Date(weekEnd) });
          console.log(`Week: ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}`);
        }
        
        // Move to next Monday
        currentMonday.setDate(currentMonday.getDate() + 7);
      }
      
      // Now create budgets for each week
      for (const week of weeks) {
        // Check if this week already has a budget
        const existingBudget = await WeeklyBudget.findOne({
          userId: req.user._id,
          weekStartDate: { $lte: week.end },
          weekEndDate: { $gte: week.start }
        });
        
        if (!existingBudget) {
          // Create categories array for the budget - but with 0 allocation initially
          const budgetCategories = [];
          
          // Add Quick Payment category with 0 allocation
          const quickPaymentCategory = categories.find(c => c.name === 'Quick Payment' || c.isSystem === true);
          if (quickPaymentCategory) {
            budgetCategories.push({
              categoryId: quickPaymentCategory._id,
              allocation: 0, // User must configure
              payments: []
            });
            console.log('Added Quick Payment category to budget:', quickPaymentCategory._id);
          } else {
            console.log('Quick Payment category not found in categories list');
          }
          
          // Add other essential categories with 0 allocation
          const essentialCategories = ['Alimentación', 'Transporte', 'Otros Gastos'];
          categories.forEach(category => {
            if (essentialCategories.includes(category.name)) {
              budgetCategories.push({
                categoryId: category._id,
                allocation: 0, // User must configure
                payments: []
              });
            }
          });
          
          // Total budget starts at 0 - user must configure
          const totalBudget = 0;
          
          // Create the weekly budget
          const weeklyBudget = new WeeklyBudget({
            userId: req.user._id,
            weekStartDate: week.start,
            weekEndDate: week.end,
            totalBudget: totalBudget,
            remainingBudget: totalBudget,
            categories: budgetCategories
          });
          
          await weeklyBudget.save();
          await weeklyBudget.populate('categories.categoryId');
          createdBudgets.push(weeklyBudget);
        }
      }
      
      return res.json({
        message: `${createdBudgets.length} presupuestos semanales creados para el mes`,
        weeklyBudgets: createdBudgets,
        weeklyBudget: createdBudgets[0] // Return first week for navigation
      });
    }
    
    // Original behavior: create only current week
    const now = new Date();
    const weekStart = new Date(now);
    // Calculate Monday as start of week
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    weekStart.setDate(now.getDate() + daysToMonday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    // Check if weekly budget already exists
    let weeklyBudget = await WeeklyBudget.findOne({
      userId: req.user._id,
      weekStartDate: { $lte: weekEnd },
      weekEndDate: { $gte: weekStart }
    });
    
    // Also check if there's a main budget with a weekly allocation for this period
    if (!weeklyBudget) {
      const MainBudget = require('../models/MainBudget');
      const activeMainBudget = await MainBudget.findOne({
        userId: req.user._id,
        status: 'active',
        'period.startDate': { $lte: weekEnd },
        'period.endDate': { $gte: weekStart }
      });
      
      if (activeMainBudget) {
        // Find the corresponding week in the main budget
        const weekData = activeMainBudget.getWeeklyBudgetForDate(weekStart);
        
        if (weekData && weekData.budgetId) {
          // Get the weekly budget from the main budget
          weeklyBudget = await WeeklyBudget.findById(weekData.budgetId)
            .populate('categories.categoryId');
        }
      }
    }
    
    if (!weeklyBudget) {
      // Get all expense categories
      const categories = await Category.find({
        $or: [
          { userId: null, type: 'expense' },
          { userId: req.user._id, type: 'expense' }
        ]
      });
      
      // Create categories array for the budget
      const budgetCategories = [];
      
      // Add Quick Payment category with 0 allocation
      const quickPaymentCategory = categories.find(c => c.name === 'Quick Payment' || c.isSystem === true);
      if (quickPaymentCategory) {
        budgetCategories.push({
          categoryId: quickPaymentCategory._id,
          allocation: 0, // User must configure
          payments: []
        });
        console.log('Added Quick Payment category to budget:', quickPaymentCategory._id);
      } else {
        console.log('Quick Payment category not found in categories list');
      }
      
      // Add other essential categories with 0 allocation
      const essentialCategories = ['Alimentación', 'Transporte', 'Otros Gastos'];
      categories.forEach(category => {
        if (essentialCategories.includes(category.name)) {
          budgetCategories.push({
            categoryId: category._id,
            allocation: 0, // User must configure
            payments: []
          });
        }
      });
      
      // Total budget starts at 0 - user must configure
      const totalBudget = 0;
      
      // Create the weekly budget
      weeklyBudget = new WeeklyBudget({
        userId: req.user._id,
        weekStartDate: weekStart,
        weekEndDate: weekEnd,
        totalBudget: totalBudget,
        remainingBudget: totalBudget,
        categories: budgetCategories
      });
      
      await weeklyBudget.save();
      
      // Populate categories for response
      await weeklyBudget.populate('categories.categoryId');
    }
    
    res.json({
      success: true,
      message: 'Presupuesto rápido creado exitosamente',
      weeklyBudget
    });
    
  } catch (error) {
    console.error('Error creating quick monthly budget:', error);
    res.status(500).json({ error: 'Failed to create quick monthly budget' });
  }
});

module.exports = router;
