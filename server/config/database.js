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
    const Category = require('../models/Category');
    
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
    
    // Check if default categories exist
    const categoryCount = await Category.countDocuments({ userId: null });
    
    if (categoryCount === 0) {
      // Create default categories
      const defaultCategories = [
        // Income categories
        { name: 'Salario', type: 'income', color: '#4CAF50', icon: '💰', userId: null },
        { name: 'Freelance', type: 'income', color: '#8BC34A', icon: '💻', userId: null },
        { name: 'Inversiones', type: 'income', color: '#00BCD4', icon: '📈', userId: null },
        { name: 'Otros Ingresos', type: 'income', color: '#009688', icon: '💵', userId: null },
        
        // Expense categories
        { name: 'Alimentación', type: 'expense', color: '#FF5722', icon: '🍔', userId: null },
        { name: 'Transporte', type: 'expense', color: '#FF9800', icon: '🚗', userId: null },
        { name: 'Vivienda', type: 'expense', color: '#795548', icon: '🏠', userId: null },
        { name: 'Servicios', type: 'expense', color: '#607D8B', icon: '💡', userId: null },
        { name: 'Salud', type: 'expense', color: '#E91E63', icon: '🏥', userId: null },
        { name: 'Educación', type: 'expense', color: '#9C27B0', icon: '📚', userId: null },
        { name: 'Entretenimiento', type: 'expense', color: '#673AB7', icon: '🎮', userId: null },
        { name: 'Compras', type: 'expense', color: '#3F51B5', icon: '🛍️', userId: null },
        { name: 'Otros Gastos', type: 'expense', color: '#9E9E9E', icon: '📦', userId: null }
      ];
      
      await Category.insertMany(defaultCategories);
      console.log('Default categories created');
    }
    
  } catch (error) {
    console.error('Error initializing default data:', error);
  }
}

module.exports = connectDB;
