const mongoose = require('mongoose');

const weeklyBudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  householdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household'
  },
  isSharedWithHousehold: {
    type: Boolean,
    default: false
  },
  parentBudgetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MainBudget'
  },
  weekNumber: {
    type: Number
  },
  weekStartDate: {
    type: Date,
    required: true
  },
  weekEndDate: {
    type: Date,
    required: true
  },
  totalBudget: {
    type: Number,
    required: true,
    min: 0
  },
  creationMode: {
    type: String,
    enum: ['template', 'smart', 'manual', 'fromMainBudget'],
    default: 'manual'
  },
  template: {
    fromWeekId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WeeklyBudget'
    },
    modifications: [{
      field: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed
    }]
  },
  // New categories structure with embedded payments
  categories: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    allocation: {
      type: Number,
      required: true,
      min: 0
    },
    payments: [{
      name: {
        type: String,
        required: true,
        trim: true
      },
      amount: {
        type: Number,
        required: true,
        min: 0
      },
      scheduledDate: {
        type: Date,
        required: true
      },
      status: {
        type: String,
        enum: ['pending', 'paying', 'paid', 'overdue'],
        default: 'pending'
      },
      paidDate: Date,
      paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      paymentScheduleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentSchedule'
      },
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction'
      },
      isRecurring: {
        type: Boolean,
        default: false
      },
      recurringId: String,
      notes: String
    }]
  }],
  allocations: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    name: {
      type: String,
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    spent: {
      type: Number,
      default: 0
    },
    scheduledDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'overdue'],
      default: 'pending'
    },
    paidDate: {
      type: Date
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction'
    }
  }],
  scheduledPayments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentSchedule'
  }],
  remainingBudget: {
    type: Number,
    default: function() {
      return this.totalBudget;
    }
  },
  insights: {
    topCategories: [{
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
      },
      amount: Number,
      percentage: Number
    }],
    savingsPotential: Number,
    recommendations: [String],
    lastAnalyzed: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Manual status override (if user sets it)
  manualStatus: {
    type: String,
    enum: ['active', 'completed', 'upcoming', 'past'],
    default: null
  }
});

// Virtual property to calculate status based on dates
weeklyBudgetSchema.virtual('status').get(function() {
  // If manual status is set, use it
  if (this.manualStatus) {
    return this.manualStatus;
  }
  
  // Otherwise calculate based on dates
  const now = new Date();
  const weekStart = new Date(this.weekStartDate);
  const weekEnd = new Date(this.weekEndDate);
  
  // Set time to start of day for accurate comparison
  now.setHours(0, 0, 0, 0);
  weekStart.setHours(0, 0, 0, 0);
  weekEnd.setHours(23, 59, 59, 999);
  
  if (now < weekStart) {
    return 'upcoming';
  } else if (now >= weekStart && now <= weekEnd) {
    return 'active';
  } else {
    return 'past';
  }
});

// Ensure virtual fields are included in JSON
weeklyBudgetSchema.set('toJSON', { virtuals: true });
weeklyBudgetSchema.set('toObject', { virtuals: true });

// Update remaining budget when allocations change
weeklyBudgetSchema.methods.updateRemainingBudget = function() {
  // Support both old allocations and new categories structure
  let totalAllocated = 0;
  
  if (this.categories && this.categories.length > 0) {
    totalAllocated = this.categories.reduce((sum, cat) => sum + cat.allocation, 0);
  } else if (this.allocations && this.allocations.length > 0) {
    totalAllocated = this.allocations.reduce((sum, alloc) => sum + alloc.amount, 0);
  }
  
  this.remainingBudget = this.totalBudget - totalAllocated;
};

// Get spending by category - works with new structure
weeklyBudgetSchema.methods.getSpendingByCategory = function() {
  if (this.categories && this.categories.length > 0) {
    return this.categories.map(cat => {
      const totalSpent = cat.payments.reduce((sum, payment) => {
        return payment.status === 'paid' ? sum + payment.amount : sum;
      }, 0);
      
      return {
        categoryId: cat.categoryId,
        allocated: cat.allocation,
        spent: totalSpent,
        scheduled: cat.payments.reduce((sum, p) => sum + p.amount, 0),
        remaining: cat.allocation - totalSpent,
        percentageUsed: cat.allocation > 0 ? (totalSpent / cat.allocation) * 100 : 0,
        payments: cat.payments
      };
    });
  }
  
  // Fallback for old structure
  return this.allocations.map(alloc => ({
    categoryId: alloc.categoryId,
    allocated: alloc.amount,
    spent: alloc.spent,
    remaining: alloc.amount - alloc.spent,
    percentageUsed: alloc.amount > 0 ? (alloc.spent / alloc.amount) * 100 : 0
  }));
};

// Get total scheduled amount
weeklyBudgetSchema.methods.getTotalScheduled = function() {
  if (this.categories && this.categories.length > 0) {
    return this.categories.reduce((total, cat) => {
      const catTotal = cat.payments.reduce((sum, payment) => sum + payment.amount, 0);
      return total + catTotal;
    }, 0);
  }
  return 0;
};

// Add payment to category
weeklyBudgetSchema.methods.addPaymentToCategory = function(categoryId, payment) {
  const category = this.categories.find(cat => 
    cat.categoryId.toString() === categoryId.toString()
  );
  
  if (!category) {
    throw new Error('Category not found in budget');
  }
  
  // TEMPORARY FIX: Disable allocation checking entirely
  // TODO: Re-enable smart allocation checking after deployment issues are resolved
  console.log(`[WeeklyBudget] Adding payment: ${payment.name}, amount: ${payment.amount}, category allocation: ${category.allocation || 'not set'}`);
  console.log(`[WeeklyBudget] ALLOCATION CHECK DISABLED - Allowing all payments`);
  
  // Original allocation check - DISABLED for now
  /*
  if (category.allocation > 0) {
    const totalInCategory = category.payments.reduce((sum, p) => sum + p.amount, 0);
    console.log(`[WeeklyBudget] Category has allocation. Total in category: ${totalInCategory}, new total would be: ${totalInCategory + payment.amount}`);
    
    if (totalInCategory + payment.amount > category.allocation) {
      console.error(`[WeeklyBudget] Payment rejected: ${totalInCategory} + ${payment.amount} > ${category.allocation}`);
      throw new Error('Payment would exceed category allocation');
    }
  } else {
    console.log(`[WeeklyBudget] Category allocation is 0 or not set, allowing payment without limit`);
  }
  */
  
  category.payments.push(payment);
  return this.save();
};

// Static method to get current week's budget
weeklyBudgetSchema.statics.getCurrentWeek = async function(userId) {
  const now = new Date();
  const startOfWeek = new Date(now);
  // Calculate Monday as start of week
  const dayOfWeek = now.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday (0), go back 6 days; otherwise go to Monday
  startOfWeek.setDate(now.getDate() + daysToMonday);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
  endOfWeek.setHours(23, 59, 59, 999);

  return this.findOne({
    userId,
    weekStartDate: { $lte: now },
    weekEndDate: { $gte: now }
  }).populate('categories.categoryId allocations.categoryId scheduledPayments');
};

// Static method to create from template
weeklyBudgetSchema.statics.createFromTemplate = async function(userId, weekStartDate, templateId) {
  const template = await this.findById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }
  
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  weekEndDate.setHours(23, 59, 59, 999);
  
  const newBudget = new this({
    userId,
    weekStartDate,
    weekEndDate,
    totalBudget: template.totalBudget,
    creationMode: 'template',
    template: {
      fromWeekId: templateId,
      modifications: []
    },
    categories: template.categories.map(cat => ({
      categoryId: cat.categoryId,
      allocation: cat.allocation,
      payments: cat.payments.map(payment => ({
        name: payment.name,
        amount: payment.amount,
        scheduledDate: new Date(weekStartDate.getTime() + 
          (payment.scheduledDate.getTime() - template.weekStartDate.getTime())),
        status: 'pending',
        isRecurring: payment.isRecurring,
        recurringId: payment.recurringId,
        notes: payment.notes
      }))
    }))
  });
  
  return newBudget.save();
};

module.exports = mongoose.model('WeeklyBudget', weeklyBudgetSchema);
