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
  }
});

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
  
  // Only check allocation if it's set (greater than 0)
  // This allows categories to be used without predefined allocations
  // Updated: Allow unlimited payments when allocation is 0
  if (category.allocation > 0) {
    const totalInCategory = category.payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalInCategory + payment.amount > category.allocation) {
      throw new Error('Payment would exceed category allocation');
    }
  }
  
  category.payments.push(payment);
  return this.save();
};

// Static method to get current week's budget
weeklyBudgetSchema.statics.getCurrentWeek = async function(userId) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
  endOfWeek.setHours(23, 59, 59, 999);

  return this.findOne({
    userId,
    weekStartDate: { $lte: now },
    weekEndDate: { $gte: now }
  }).populate('allocations.categoryId categories.categoryId scheduledPayments');
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
