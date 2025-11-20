const mongoose = require('mongoose');

const paymentScheduleSchema = new mongoose.Schema({
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
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    default: 'expense' // Most payments are expenses
  },
  dueDate: {
    type: Date,
    required: true
  },
  frequency: {
    type: String,
    enum: ['once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
    default: 'once'
  },
  status: {
    type: String,
    enum: ['pending', 'paying', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  paidDate: Date,
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: String,
  reminder: {
    enabled: {
      type: Boolean,
      default: true
    },
    daysBefore: {
      type: Number,
      default: 1
    }
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringEndDate: Date,
  weeklyBudgetId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WeeklyBudget'
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

// Update the updatedAt timestamp on save
paymentScheduleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if payment is overdue
paymentScheduleSchema.methods.checkOverdue = function() {
  if (this.status === 'pending' && this.dueDate < new Date()) {
    this.status = 'overdue';
    return true;
  }
  return false;
};

// Method to mark as paid
paymentScheduleSchema.methods.markAsPaid = function(paidDate = new Date()) {
  this.status = 'paid';
  this.paidDate = paidDate;
};

// Static method to get upcoming payments
paymentScheduleSchema.statics.getUpcoming = async function(userId, days = 7) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return this.find({
    userId,
    status: { $in: ['pending', 'overdue'] },
    dueDate: { $gte: startDate, $lte: endDate }
  }).sort('dueDate');
};

module.exports = mongoose.model('PaymentSchedule', paymentScheduleSchema);
