const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app';
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB connected successfully');
    
    // Initialize default data
    await initializeDefaultData();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Initialize default categories and demo user
async function initializeDefaultData() {
  try {
    const User = require('../models/User');
    const validateDefaultCategories = require('../scripts/validateDefaultCategories');
    
    // Check if demo user exists
    let demoUser = await User.findOne({ username: 'demo' });
    
    if (!demoUser) {
      // Create demo user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('demo123', 10);
      
      demoUser = await User.create({
        username: 'demo',
        email: 'demo@example.com',
        password: hashedPassword
      });
      
      console.log('Demo user created');
    }
    
    // Validate and ensure all default categories exist
    await validateDefaultCategories();
    
  } catch (error) {
    console.error('Error initializing default data:', error);
  }
}

module.exports = connectDB;
