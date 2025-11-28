const express = require('express');
const router = express.Router();
const { authMiddleware: auth } = require('../middleware/auth');
const PaymentSchedule = require('../models/PaymentSchedule');
const Transaction = require('../models/Transaction');
const MainBudget = require('../models/MainBudget');
const WeeklyBudget = require('../models/WeeklyBudget');
const { createNotification } = require('./notifications');
const { getIo } = require('../utils/socketManager');
const { startOfWeek, endOfWeek, startOfMonth, endOfMonth } = require('date-fns');

// Get all payment schedules
router.get('/', auth, async (req, res) => {
  try {
    const { status, from, to, upcoming } = req.query;
    const query = { userId: req.user._id };

    console.log('GET /api/payments - Query params:', { status, from, to, upcoming, userId: req.user._id });

    if (status) {
      query.status = status;
    }

    if (from && to) {
      // Parse dates properly - handle both 'yyyy-MM-dd' and ISO formats
      const fromDate = new Date(from);
      const toDate = new Date(to);
      
      // Set time to start and end of day to capture all payments
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      query.dueDate = {
        $gte: fromDate,
        $lte: toDate
      };
      console.log('Date range filter:', { from: fromDate.toISOString(), to: toDate.toISOString() });
    }

    if (upcoming === 'true') {
      // Get next 7 days of payments
      const payments = await PaymentSchedule.getUpcoming(req.user._id, 7);
      console.log(`Found ${payments.length} upcoming payments`);
      return res.json(payments);
    }

    console.log('Final query:', JSON.stringify(query, null, 2));
    
    const payments = await PaymentSchedule.find(query)
      .populate('categoryId')
      .sort('dueDate');

    console.log(`Found ${payments.length} payments for date range`);
    payments.forEach(p => {
      console.log(`  - ${p.name}: ${p.dueDate} (${p.status}) category: ${p.categoryId?.name || 'none'}`);
    });

    // Check and update overdue status
    for (const payment of payments) {
      const wasOverdue = payment.checkOverdue();
      if (wasOverdue) {
        await payment.save();
      }
    }

    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get ALL payment schedules (no date filtering) - for calendar view
router.get('/all', auth, async (req, res) => {
  try {
    console.log('GET /api/payments/all - Fetching all payments for user:', req.user._id);
    
    const payments = await PaymentSchedule.find({ userId: req.user._id })
      .populate('categoryId')
      .sort('dueDate');

    console.log(`Found ${payments.length} total payments`);
    payments.forEach(p => {
      console.log(`  - ${p.name}: ${p.dueDate} (${p.status})`);
    });

    res.json(payments);
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payment schedule by id
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await PaymentSchedule.findOne({
      _id: req.params.id,
      userId: req.user._id
    }).populate('categoryId');

    if (!payment) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Create payment schedule
router.post('/', auth, async (req, res) => {
  try {
    const {
      name,
      amount,
      categoryId,
      dueDate,
      frequency,
      notes,
      reminder,
      isRecurring,
      recurringEndDate,
      householdId
    } = req.body;

    console.log('POST /api/payments - Creating payment:', { name, amount, categoryId, dueDate });

    // Parse the date properly to avoid timezone issues
    // If dueDate is just a date string (YYYY-MM-DD), parse it as local date at noon
    let paymentDate;
    if (typeof dueDate === 'string' && dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Date-only string - parse as local date at noon to avoid timezone shifts
      const [year, month, day] = dueDate.split('-').map(Number);
      paymentDate = new Date(year, month - 1, day, 12, 0, 0);
    } else {
      paymentDate = new Date(dueDate);
    }
    
    console.log('Parsed payment date:', paymentDate.toISOString(), 'Local:', paymentDate.toLocaleDateString());

    // Check for duplicate payment (same name, amount, and date within 10 seconds)
    const tenSecondsAgo = new Date(Date.now() - 10000);
    const existingPayment = await PaymentSchedule.findOne({
      userId: req.user._id,
      name,
      amount,
      createdAt: { $gte: tenSecondsAgo }
    });

    if (existingPayment) {
      console.log('Duplicate payment detected, returning existing:', existingPayment._id);
      const populatedPayment = await PaymentSchedule.findById(existingPayment._id).populate('categoryId');
      return res.status(200).json(populatedPayment);
    }
    
    const payment = new PaymentSchedule({
      userId: req.user._id,
      name,
      amount,
      categoryId,
      dueDate: paymentDate,
      frequency: frequency || 'once',
      notes,
      reminder,
      isRecurring: isRecurring || false,
      recurringEndDate: recurringEndDate ? new Date(recurringEndDate) : null,
      householdId
    });

    await payment.save();
    console.log('Payment saved with ID:', payment._id);

    // Try to link to the appropriate weekly budget (or create one if needed)
    try {
      // Calculate week boundaries
      const weekStart = startOfWeek(paymentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(paymentDate, { weekStartsOn: 1 });
      
      // Set proper times
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(23, 59, 59, 999);
      
      console.log('Looking for WeeklyBudget for week:', weekStart, '-', weekEnd);
      
      // Find existing weekly budget for this week
      let weeklyBudget = await WeeklyBudget.findOne({
        userId: req.user._id,
        weekStartDate: { $lte: paymentDate },
        weekEndDate: { $gte: paymentDate }
      });
      
      console.log('Existing WeeklyBudget found:', weeklyBudget ? weeklyBudget._id : 'none');
      
      // If no weekly budget exists, create one automatically
      if (!weeklyBudget) {
        console.log('Creating new WeeklyBudget for payment');
        
        // Look for a MainBudget to get the weekly amount, but don't require it
        const monthStart = startOfMonth(paymentDate);
        const monthEnd = endOfMonth(paymentDate);
        
        const mainBudget = await MainBudget.findOne({
          userId: req.user._id,
          'period.startDate': { $lte: monthEnd },
          'period.endDate': { $gte: monthStart },
          status: { $in: ['active', 'draft'] }
        });
        
        // Create a new weekly budget
        weeklyBudget = new WeeklyBudget({
          userId: req.user._id,
          parentBudgetId: mainBudget?._id || null,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          totalBudget: mainBudget?.calculateWeeklyAmount?.() || 0,
          categories: [],
          manualStatus: 'active',
          creationMode: 'manual'
        });
        
        await weeklyBudget.save();
        console.log('Created new WeeklyBudget:', weeklyBudget._id);
        
        // If we have a main budget, update its reference
        if (mainBudget) {
          const weekInfo = mainBudget.weeklyBudgets.find(w => {
            const wStart = new Date(w.startDate);
            const wEnd = new Date(w.endDate);
            return paymentDate >= wStart && paymentDate <= wEnd;
          });
          
          if (weekInfo) {
            weekInfo.budgetId = weeklyBudget._id;
            weekInfo.status = 'active';
            await mainBudget.save();
          }
        }
      }
      
      // Now link the payment to the weekly budget
      console.log('Linking payment to WeeklyBudget:', weeklyBudget._id);
      
      // Find or create the category in the weekly budget
      let categoryEntry = weeklyBudget.categories.find(
        c => c.categoryId && c.categoryId.toString() === categoryId.toString()
      );
      
      if (!categoryEntry) {
        // Add the category to the weekly budget
        weeklyBudget.categories.push({
          categoryId: categoryId,
          allocation: 0,
          payments: []
        });
        categoryEntry = weeklyBudget.categories[weeklyBudget.categories.length - 1];
        console.log('Created new category entry in WeeklyBudget');
      }
      
      // Add the payment to the category
      categoryEntry.payments.push({
        name: name,
        amount: amount,
        scheduledDate: paymentDate,
        status: 'pending',
        paymentScheduleId: payment._id
      });
      
      // Update the payment with the weekly budget reference
      payment.weeklyBudgetId = weeklyBudget._id;
      await payment.save();
      
      weeklyBudget.markModified('categories');
      await weeklyBudget.save();
      console.log('Added payment to WeeklyBudget successfully');
      
    } catch (budgetError) {
      // Log but don't fail - the payment is still created
      console.error('Error linking payment to budget:', budgetError);
    }

    // Create reminder notification if enabled
    if (reminder?.enabled) {
      const reminderDate = new Date(dueDate);
      reminderDate.setDate(reminderDate.getDate() - (reminder.daysBefore || 1));
      
      if (reminderDate > new Date()) {
        await createNotification(
          req.user._id,
          'payment_reminder',
          `Payment reminder: ${name} is due in ${reminder.daysBefore || 1} day(s)`,
          {
            paymentId: payment._id,
            amount,
            dueDate
          }
        );
      }
    }

    const populatedPayment = await PaymentSchedule.findById(payment._id).populate('categoryId');
    res.status(201).json(populatedPayment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment schedule' });
  }
});

// Update payment schedule
router.put('/:id', auth, async (req, res) => {
  try {
    const payment = await PaymentSchedule.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    const updatableFields = [
      'name', 'amount', 'categoryId', 'dueDate', 
      'frequency', 'notes', 'reminder', 'isRecurring', 
      'recurringEndDate', 'status'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        payment[field] = req.body[field];
      }
    });

    await payment.save();
    
    const updatedPayment = await PaymentSchedule.findById(payment._id).populate('categoryId');
    res.json(updatedPayment);
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ error: 'Failed to update payment schedule' });
  }
});

// Mark payment as paid
router.post('/:id/pay', auth, async (req, res) => {
  try {
    const payment = await PaymentSchedule.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    // Mark as paid
    payment.markAsPaid(req.body.paidDate);
    await payment.save();

    // Create a transaction for this payment
    const transaction = new Transaction({
      userId: req.user._id,
      type: 'expense',
      amount: payment.amount,
      categoryId: payment.categoryId,
      description: `Payment: ${payment.name}`,
      date: payment.paidDate || new Date(),
      paymentScheduleId: payment._id,
      householdId: payment.householdId
    });

    await transaction.save();

    // If recurring, create next payment
    if (payment.isRecurring && payment.frequency !== 'once') {
      const nextDueDate = new Date(payment.dueDate);
      
      switch (payment.frequency) {
        case 'weekly':
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case 'biweekly':
          nextDueDate.setDate(nextDueDate.getDate() + 14);
          break;
        case 'monthly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case 'quarterly':
          nextDueDate.setMonth(nextDueDate.getMonth() + 3);
          break;
        case 'yearly':
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
      }

      if (!payment.recurringEndDate || nextDueDate <= payment.recurringEndDate) {
        const nextPayment = new PaymentSchedule({
          userId: payment.userId,
          name: payment.name,
          amount: payment.amount,
          categoryId: payment.categoryId,
          dueDate: nextDueDate,
          frequency: payment.frequency,
          notes: payment.notes,
          reminder: payment.reminder,
          isRecurring: payment.isRecurring,
          recurringEndDate: payment.recurringEndDate,
          householdId: payment.householdId
        });

        await nextPayment.save();
      }
    }

    res.json({ payment, transactionId: transaction._id });
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    res.status(500).json({ error: 'Failed to mark payment as paid' });
  }
});

// Update payment status
router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, paidBy } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const validStatuses = ['pending', 'paying', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const payment = await PaymentSchedule.findOne({
      _id: req.params.id
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    // Verify user has access to this payment (owner or household member with permissions)
    let hasAccess = payment.userId.equals(req.user._id);
    let userRole = null;
    let userPermissions = null;
    
    if (!hasAccess && payment.householdId) {
      const Household = require('../models/Household');
      const household = await Household.findOne({
        _id: payment.householdId,
        $or: [
          { createdBy: req.user._id },
          { 'members.user': req.user._id }
        ]
      });
      
      if (household) {
        // Check if user is the owner
        if (household.createdBy && household.createdBy.toString() === req.user._id.toString()) {
          hasAccess = true;
          userRole = 'owner';
        } else {
          // Check member permissions
          const member = household.members.find(m => 
            (m.user._id || m.user).toString() === req.user._id.toString()
          );
          
          if (member) {
            userRole = member.role;
            userPermissions = member.permissions;
            
            // Check if user has permission to edit transactions
            hasAccess = member.role === 'admin' || 
                       (member.permissions && member.permissions.canEditTransactions);
            
            console.log('Member permissions check:', {
              userId: req.user._id,
              role: member.role,
              permissions: member.permissions,
              hasAccess
            });
          }
        }
      }
    }
    
    if (!hasAccess) {
      console.log('Access denied for payment update:', {
        paymentId: req.params.id,
        userId: req.user._id,
        userRole,
        userPermissions,
        paymentUserId: payment.userId,
        paymentHouseholdId: payment.householdId
      });
      return res.status(403).json({ error: 'You do not have permission to update this payment' });
    }

    const previousStatus = payment.status;
    payment.status = status;
    
    // Set paidDate and paidBy if marking as paid
    if (status === 'paid') {
      if (!payment.paidDate) {
        payment.paidDate = new Date();
      }
      if (paidBy) {
        payment.paidBy = paidBy;
      } else {
        payment.paidBy = req.user._id;
      }
      
      console.log('Payment marked as paid:', {
        paymentId: payment._id,
        paidBy: payment.paidBy,
        paidByType: typeof payment.paidBy,
        userId: req.user._id
      });

      // Create a transaction if this is a new "paid" status (wasn't paid before)
      if (previousStatus !== 'paid') {
        try {
          // Check if a transaction already exists for this payment
          const existingTransaction = await Transaction.findOne({
            paymentScheduleId: payment._id
          });

          if (!existingTransaction) {
            // Get user to get their currency preference
            const User = require('../models/User');
            const user = await User.findById(req.user._id);
            
            const transaction = new Transaction({
              userId: req.user._id,
              type: 'expense',
              amount: payment.amount,
              categoryId: payment.categoryId,
              description: `Pago: ${payment.name}`,
              date: payment.paidDate || new Date(),
              paymentScheduleId: payment._id,
              householdId: payment.householdId,
              currency: user?.currency || 'PEN'
            });

            await transaction.save();
            console.log('Transaction created for payment:', transaction._id, 'userId:', req.user._id);
          } else {
            console.log('Transaction already exists for payment:', existingTransaction._id);
          }
        } catch (txError) {
          console.error('Error creating transaction for payment:', txError);
          // Don't fail the payment update if transaction creation fails
        }
      }
    }
    
    // Clear paidDate and paidBy if reverting from paid status
    if (status !== 'paid') {
      payment.paidDate = undefined;
      payment.paidBy = undefined;
      
      // If reverting from paid, delete the associated transaction
      if (previousStatus === 'paid') {
        try {
          const deletedTransaction = await Transaction.findOneAndDelete({
            paymentScheduleId: payment._id
          });
          if (deletedTransaction) {
            console.log('Deleted transaction for reverted payment:', deletedTransaction._id);
          }
        } catch (txError) {
          console.error('Error deleting transaction for reverted payment:', txError);
        }
      }
    }
    
    await payment.save();
    
    const updatedPayment = await PaymentSchedule.findById(payment._id)
      .populate('categoryId')
      .populate('paidBy', 'name email');
    
    // Update the corresponding weekly budget payment if it exists
    console.log('Checking for weekly budget update:', {
      paymentId: payment._id,
      weeklyBudgetId: payment.weeklyBudgetId,
      newStatus: status
    });
    
    if (payment.weeklyBudgetId) {
      const WeeklyBudget = require('../models/WeeklyBudget');
      const budget = await WeeklyBudget.findById(payment.weeklyBudgetId);
      
      if (budget) {
        console.log('Found budget to update:', budget._id);
        let paymentFound = false;
        
        // Find and update payment in categories
        budget.categories.forEach((cat, catIndex) => {
          cat.payments.forEach((budgetPayment, payIndex) => {
            // Log each payment being checked
            console.log(`Checking payment [${catIndex}][${payIndex}]:`, {
              name: budgetPayment.name,
              _id: budgetPayment._id?.toString(),
              paymentScheduleId: budgetPayment.paymentScheduleId?.toString(),
              lookingFor: payment._id.toString()
            });
            
            // Check if this is the payment we're looking for
            const isMatch = budgetPayment.paymentScheduleId?.toString() === payment._id.toString() ||
                          budgetPayment._id?.toString() === payment._id.toString();
            
            if (isMatch) {
              console.log('MATCH FOUND! Updating payment:', budgetPayment.name);
              paymentFound = true;
              budgetPayment.status = status;
              if (status === 'paid') {
                budgetPayment.paidDate = payment.paidDate;
                // Store just the ID - it will be populated when fetched
                budgetPayment.paidBy = payment.paidBy;
              } else {
                budgetPayment.paidDate = undefined;
                budgetPayment.paidBy = undefined;
              }
            }
          });
        });
        
        if (!paymentFound) {
          console.log('WARNING: Payment not found in budget categories');
        } else {
          // Mark the budget as modified to ensure it saves
          budget.markModified('categories');
          
          try {
            await budget.save();
            console.log('Budget saved successfully');
            
            // Verify the update
            const updatedBudget = await WeeklyBudget.findById(budget._id);
            const verifyPayment = updatedBudget.categories
              .flatMap(cat => cat.payments)
              .find(p => p.paymentScheduleId?.toString() === payment._id.toString());
            
            if (verifyPayment) {
              console.log('Verification - Payment status after save:', verifyPayment.status);
            } else {
              console.log('WARNING: Payment not found in budget after save!');
            }
          } catch (saveError) {
            console.error('Error saving budget:', saveError);
          }
        }
      } else {
        console.log('WARNING: Budget not found with ID:', payment.weeklyBudgetId);
      }
    } else {
      console.log('Payment has no weeklyBudgetId, skipping budget update');
    }
    
    res.json(updatedPayment);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ error: 'Failed to update payment status' });
  }
});

// Delete payment schedule
router.delete('/:id', auth, async (req, res) => {
  try {
    const payment = await PaymentSchedule.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment schedule not found' });
    }

    res.json({ message: 'Payment schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment schedule' });
  }
});

// Get payment analytics
router.get('/analytics/overview', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const payments = await PaymentSchedule.find({
      userId: req.user._id,
      dueDate: { $gte: startDate, $lte: endDate }
    }).populate('categoryId');

    const analytics = {
      totalScheduled: payments.reduce((sum, p) => sum + p.amount, 0),
      totalPaid: payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0),
      totalPending: payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0),
      totalOverdue: payments.filter(p => p.status === 'overdue').reduce((sum, p) => sum + p.amount, 0),
      paymentsByCategory: {},
      upcomingPayments: await PaymentSchedule.getUpcoming(req.user._id, 7)
    };

    // Group by category
    payments.forEach(payment => {
      const categoryName = payment.categoryId?.name || 'Uncategorized';
      if (!analytics.paymentsByCategory[categoryName]) {
        analytics.paymentsByCategory[categoryName] = {
          total: 0,
          paid: 0,
          pending: 0,
          count: 0
        };
      }
      
      analytics.paymentsByCategory[categoryName].total += payment.amount;
      analytics.paymentsByCategory[categoryName].count += 1;
      
      if (payment.status === 'paid') {
        analytics.paymentsByCategory[categoryName].paid += payment.amount;
      } else {
        analytics.paymentsByCategory[categoryName].pending += payment.amount;
      }
    });

    res.json(analytics);
  } catch (error) {
    console.error('Error getting payment analytics:', error);
    res.status(500).json({ error: 'Failed to get payment analytics' });
  }
});

module.exports = router;
