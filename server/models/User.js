const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    trim: true,
    default: ''
  },
  currency: {
    type: String,
    enum: ['USD', 'PEN'],
    default: 'PEN'
  },
  phone: {
    type: String,
    trim: true
  },
  language: {
    type: String,
    default: 'es'
  },
  timezone: {
    type: String,
    default: 'America/Lima'
  },
  dateFormat: {
    type: String,
    default: 'DD/MM/YYYY'
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light'
  },
  notifications: {
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    budgetAlerts: { type: Boolean, default: true },
    transactionAlerts: { type: Boolean, default: true },
    weeklyReport: { type: Boolean, default: false },
    monthlyReport: { type: Boolean, default: true }
  },
  privacy: {
    profileVisible: { type: Boolean, default: true },
    showEmail: { type: Boolean, default: false },
    showStats: { type: Boolean, default: true }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
userSchema.index({ username: 1, email: 1 });

module.exports = mongoose.model('User', userSchema);
