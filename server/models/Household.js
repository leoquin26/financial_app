const mongoose = require('mongoose');

const householdSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    maxlength: 500
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'member', 'viewer'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    permissions: {
      canAddTransactions: {
        type: Boolean,
        default: true
      },
      canEditTransactions: {
        type: Boolean,
        default: true
      },
      canDeleteTransactions: {
        type: Boolean,
        default: false
      },
      canManageBudgets: {
        type: Boolean,
        default: true
      },
      canManageCategories: {
        type: Boolean,
        default: true
      },
      canInviteMembers: {
        type: Boolean,
        default: false
      },
      canViewAnalytics: {
        type: Boolean,
        default: true
      }
    }
  }],
  settings: {
    currency: {
      type: String,
      default: 'PEN'
    },
    defaultBudgetPeriod: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly'
    },
    autoAcceptMembers: {
      type: Boolean,
      default: false
    },
    requireApprovalForExpenses: {
      type: Boolean,
      default: false
    },
    expenseLimit: {
      type: Number,
      default: 0
    },
    notifyOnExpense: {
      type: Boolean,
      default: true
    },
    notifyOnBudgetExceed: {
      type: Boolean,
      default: true
    },
    shareAnalytics: {
      type: Boolean,
      default: true
    },
    allowGuestView: {
      type: Boolean,
      default: false
    },
    shareAllTransactions: {
      type: Boolean,
      default: true
    },
    shareCategories: {
      type: Boolean,
      default: true
    },
    shareBudgets: {
      type: Boolean,
      default: true
    },
    defaultSharingMode: {
      type: String,
      enum: ['all', 'selected', 'none'],
      default: 'all'
    }
  },
  isActive: {
    type: Boolean,
    default: true
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

// Indexes
householdSchema.index({ createdBy: 1 });
householdSchema.index({ 'members.user': 1 });
householdSchema.index({ isActive: 1 });

// Update timestamp on save
householdSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to check if user is member
householdSchema.methods.isMember = function(userId) {
  return this.members.some(member => {
    // Handle both populated (object) and unpopulated (ObjectId) cases
    const memberUserId = member.user._id ? member.user._id.toString() : member.user.toString();
    return memberUserId === userId.toString();
  });
};

// Method to get member role
householdSchema.methods.getMemberRole = function(userId) {
  const member = this.members.find(m => {
    // Handle both populated (object) and unpopulated (ObjectId) cases
    const memberUserId = m.user._id ? m.user._id.toString() : m.user.toString();
    return memberUserId === userId.toString();
  });
  return member ? member.role : null;
};

// Method to check permission
householdSchema.methods.hasPermission = function(userId, permission) {
  const member = this.members.find(m => {
    // Handle both populated (object) and unpopulated (ObjectId) cases
    const memberUserId = m.user._id ? m.user._id.toString() : m.user.toString();
    return memberUserId === userId.toString();
  });
  
  if (!member) return false;
  if (member.role === 'owner' || member.role === 'admin') return true;
  return member.permissions[permission] || false;
};

module.exports = mongoose.model('Household', householdSchema);
