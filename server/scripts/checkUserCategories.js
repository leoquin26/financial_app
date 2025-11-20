const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');

async function checkUserCategories(username) {
  try {
    if (username) {
      // Check specific user
      const user = await User.findOne({ username });
      if (!user) {
        console.log(`❌ User '${username}' not found`);
        return;
      }
      
      console.log(`\n👤 Categories for user: ${user.username} (${user.email})`);
      console.log('=' * 50);
      
      // Get all categories available to this user
      const categories = await Category.find({
        $or: [
          { userId: null }, // Default categories
          { userId: user._id } // User-specific categories
        ]
      }).sort({ type: -1, name: 1 }); // Sort by type (income first) then name
      
      // Separate by type
      const incomeCategories = categories.filter(c => c.type === 'income');
      const expenseCategories = categories.filter(c => c.type === 'expense');
      
      console.log('\n💰 Income Categories:');
      incomeCategories.forEach(cat => {
        const source = cat.userId ? 'Custom' : cat.isSystem ? 'System' : 'Default';
        console.log(`   ${cat.icon} ${cat.name} [${source}]`);
      });
      
      console.log('\n💸 Expense Categories:');
      expenseCategories.forEach(cat => {
        const source = cat.userId ? 'Custom' : cat.isSystem ? 'System' : 'Default';
        console.log(`   ${cat.icon} ${cat.name} [${source}]`);
      });
      
      console.log(`\n📊 Summary: ${incomeCategories.length} income, ${expenseCategories.length} expense categories`);
      
    } else {
      // Show all users and their category counts
      const users = await User.find({}).select('username email');
      
      console.log('\n👥 All Users and Their Categories:');
      console.log('=' * 60);
      
      for (const user of users) {
        const categories = await Category.find({
          $or: [
            { userId: null }, // Default categories
            { userId: user._id } // User-specific categories
          ]
        });
        
        const customCount = categories.filter(c => c.userId?.toString() === user._id.toString()).length;
        const totalCount = categories.length;
        
        console.log(`\n👤 ${user.username} (${user.email})`);
        console.log(`   Total categories: ${totalCount} (${customCount} custom)`);
      }
      
      // Show default categories summary
      const defaultCategories = await Category.find({ userId: null });
      console.log('\n📋 Default Categories Available to All Users:');
      console.log(`   Total: ${defaultCategories.length}`);
      console.log(`   Income: ${defaultCategories.filter(c => c.type === 'income').length}`);
      console.log(`   Expense: ${defaultCategories.filter(c => c.type === 'expense').length}`);
      console.log(`   System: ${defaultCategories.filter(c => c.isSystem).length}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking categories:', error);
  }
}

// If run directly
if (require.main === module) {
  const username = process.argv[2]; // Get username from command line
  
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    return checkUserCategories(username);
  })
  .then(() => {
    return mongoose.connection.close();
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
}

module.exports = checkUserCategories;
