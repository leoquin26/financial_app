const mongoose = require('mongoose');

const mainBudgetSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  householdId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  period: {
    type: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly', 'custom'],
      required: true,
      default: 'monthly'
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    // For display purposes
    year: Number,
    month: Number,
    quarter: Number
  },
  totalBudget: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  categories: [{
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    defaultAllocation: {
      type: Number,
      min: 0
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100
    },
    priority: {
      type: Number,
      default: 0
    }
  }],
  weeklyBudgets: [{
    weekNumber: {
      type: Number,
      required: true
    },
    budgetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WeeklyBudget'
    },
    startDate: Date,
    endDate: Date,
    allocatedAmount: Number,
    spentAmount: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed'],
      default: 'pending'
    }
  }],
  settings: {
    autoCreateWeekly: {
      type: Boolean,
      default: true
    },
    weeklyBudgetAmount: {
      type: Number,
      min: 0
    },
    rolloverUnspent: {
      type: Boolean,
      default: false
    },
    shareWithHousehold: {
      type: Boolean,
      default: false
    },
    notifyOnWeekStart: {
      type: Boolean,
      default: true
    },
    notifyOnOverspend: {
      type: Boolean,
      default: true
    },
    allowFlexibleAllocations: {
      type: Boolean,
      default: true
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft'
  },
  analytics: {
    totalAllocated: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    },
    totalRemaining: {
      type: Number,
      default: function() {
        return this.totalBudget;
      }
    },
    weeklyAverage: {
      type: Number,
      default: 0
    },
    categoriesCount: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
mainBudgetSchema.index({ userId: 1, 'period.startDate': -1 });
mainBudgetSchema.index({ householdId: 1, status: 1 });
mainBudgetSchema.index({ status: 1, 'period.endDate': 1 });

// Calculate weekly budget amount based on period
mainBudgetSchema.methods.calculateWeeklyAmount = function() {
  const startDate = new Date(this.period.startDate);
  const endDate = new Date(this.period.endDate);
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const totalWeeks = Math.ceil(totalDays / 7);
  
  return Math.floor(this.totalBudget / totalWeeks);
};

// Generate weekly budgets for the period
mainBudgetSchema.methods.generateWeeklyBudgets = function() {
  const weeklyBudgets = [];
  const startDate = new Date(this.period.startDate);
  const endDate = new Date(this.period.endDate);
  
  // Align to Monday as start of week
  let currentWeekStart = new Date(startDate);
  const dayOfWeek = currentWeekStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday (0), go back 6 days; otherwise go to Monday
  currentWeekStart.setDate(currentWeekStart.getDate() + daysToMonday);
  currentWeekStart.setHours(0, 0, 0, 0);
  
  let weekNumber = 1;
  
  while (currentWeekStart < endDate) {
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekEnd.getDate() + 6); // Sunday
    currentWeekEnd.setHours(23, 59, 59, 999);
    
    // Make sure we don't go past the period end date
    const weekEnd = currentWeekEnd > endDate ? endDate : currentWeekEnd;
    
    // Only include weeks that have at least one day within the budget period
    if (weekEnd >= startDate) {
      weeklyBudgets.push({
        weekNumber,
        startDate: new Date(currentWeekStart),
        endDate: new Date(weekEnd),
        allocatedAmount: this.settings.weeklyBudgetAmount || this.calculateWeeklyAmount(),
        status: 'pending',
        budgetId: null // Explicitly set to null, not undefined
      });
      weekNumber++;
    }
    
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  return weeklyBudgets;
};

// Update analytics
mainBudgetSchema.methods.updateAnalytics = async function() {
  // This will be called after weekly budgets are updated
  const WeeklyBudget = mongoose.model('WeeklyBudget');
  
  let totalSpent = 0;
  let totalAllocated = 0;
  
  // Sum up from all weekly budgets
  for (const week of this.weeklyBudgets) {
    if (week.budgetId) {
      const weeklyBudget = await WeeklyBudget.findById(week.budgetId);
      if (weeklyBudget) {
        const weekSpent = weeklyBudget.categories.reduce((sum, cat) => {
          const categorySpent = cat.payments
            .filter(p => p.status === 'paid')
            .reduce((pSum, payment) => pSum + payment.amount, 0);
          return sum + categorySpent;
        }, 0);
        
        totalSpent += weekSpent;
        // Update the spentAmount for this week
        week.spentAmount = weekSpent;
        totalAllocated += week.allocatedAmount || 0;
      } else {
        week.spentAmount = 0;
      }
    } else {
      week.spentAmount = 0;
    }
  }
  
  this.analytics.totalSpent = totalSpent;
  this.analytics.totalAllocated = totalAllocated;
  this.analytics.totalRemaining = this.totalBudget - totalSpent;
  this.analytics.weeklyAverage = this.weeklyBudgets.length > 0 
    ? Math.floor(totalSpent / this.weeklyBudgets.length)
    : 0;
  this.analytics.categoriesCount = this.categories.length;
};

// Check if a date falls within this budget period
mainBudgetSchema.methods.containsDate = function(date) {
  const checkDate = new Date(date);
  return checkDate >= this.period.startDate && checkDate <= this.period.endDate;
};

// Get active weekly budget for a specific date
mainBudgetSchema.methods.getWeeklyBudgetForDate = function(date) {
  const checkDate = new Date(date);
  
  return this.weeklyBudgets.find(week => {
    return checkDate >= week.startDate && checkDate <= week.endDate;
  });
};

// Pre-save middleware
mainBudgetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Set year, month, quarter based on start date
  const startDate = new Date(this.period.startDate);
  this.period.year = startDate.getFullYear();
  this.period.month = startDate.getMonth() + 1;
  this.period.quarter = Math.ceil((startDate.getMonth() + 1) / 3);
  
  next();
});

// Virtual for progress percentage
mainBudgetSchema.virtual('progressPercentage').get(function() {
  if (this.totalBudget === 0) return 0;
  return Math.min(100, Math.round((this.analytics.totalSpent / this.totalBudget) * 100));
});

// Virtual for days remaining
mainBudgetSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const endDate = new Date(this.period.endDate);
  const days = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
});

// Virtual for is current period
mainBudgetSchema.virtual('isCurrentPeriod').get(function() {
  const now = new Date();
  return now >= this.period.startDate && now <= this.period.endDate;
});

// Ensure virtuals are included in JSON
mainBudgetSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.__v;
    return ret;
  }
});

const MainBudget = mongoose.model('MainBudget', mainBudgetSchema);

module.exports = MainBudget;
