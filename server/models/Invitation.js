const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
  household: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Household',
    required: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  invitedEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  invitedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  role: {
    type: String,
    enum: ['admin', 'member', 'viewer'],
    default: 'member'
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
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'expired'],
    default: 'pending'
  },
  message: {
    type: String,
    maxlength: 500
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 7*24*60*60*1000) // 7 days
  },
  acceptedAt: Date,
  rejectedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
invitationSchema.index({ household: 1, invitedEmail: 1 });
invitationSchema.index({ token: 1 });
invitationSchema.index({ status: 1 });
invitationSchema.index({ expiresAt: 1 });

// Check if invitation is expired
invitationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date() || this.status === 'expired';
};

// Check if invitation is valid
invitationSchema.methods.isValid = function() {
  return this.status === 'pending' && !this.isExpired();
};

module.exports = mongoose.model('Invitation', invitationSchema);
