const mongoose = require('mongoose');
const Category = require('../models/Category');

// Define all default categories with consistent properties
const DEFAULT_CATEGORIES = [
  // Income categories
  { name: 'Salario', type: 'income', color: '#4CAF50', icon: '💰', isDefault: true, isSystem: false },
  { name: 'Freelance', type: 'income', color: '#8BC34A', icon: '💻', isDefault: true, isSystem: false },
  { name: 'Inversiones', type: 'income', color: '#00BCD4', icon: '📈', isDefault: true, isSystem: false },
  { name: 'Otros Ingresos', type: 'income', color: '#009688', icon: '💵', isDefault: true, isSystem: false },
  
  // Expense categories
  { name: 'Alimentación', type: 'expense', color: '#FF5722', icon: '🍔', isDefault: true, isSystem: false },
  { name: 'Transporte', type: 'expense', color: '#FF9800', icon: '🚗', isDefault: true, isSystem: false },
  { name: 'Vivienda', type: 'expense', color: '#795548', icon: '🏠', isDefault: true, isSystem: false },
  { name: 'Servicios', type: 'expense', color: '#607D8B', icon: '💡', isDefault: true, isSystem: false },
  { name: 'Salud', type: 'expense', color: '#E91E63', icon: '🏥', isDefault: true, isSystem: false },
  { name: 'Educación', type: 'expense', color: '#9C27B0', icon: '📚', isDefault: true, isSystem: false },
  { name: 'Entretenimiento', type: 'expense', color: '#673AB7', icon: '🎮', isDefault: true, isSystem: false },
  { name: 'Compras', type: 'expense', color: '#3F51B5', icon: '🛍️', isDefault: true, isSystem: false },
  { name: 'Otros Gastos', type: 'expense', color: '#9E9E9E', icon: '📦', isDefault: true, isSystem: false },
  
  // System categories
  { name: 'Quick Payment', type: 'expense', color: '#7C3AED', icon: '⚡', isDefault: false, isSystem: true, description: 'Automatic category for quick payments' }
];

async function validateDefaultCategories() {
  try {
    console.log('🔍 Validating Default Categories...\n');
    
    let created = 0;
    let existing = 0;
    let updated = 0;
    
    for (const defaultCat of DEFAULT_CATEGORIES) {
      // Check if category exists
      let category = await Category.findOne({
        name: defaultCat.name,
        userId: null // Default categories have no userId
      });
      
      if (!category) {
        // Create new category
        category = await Category.create({
          ...defaultCat,
          userId: null
        });
        created++;
        console.log(`✅ Created: ${defaultCat.name} (${defaultCat.type}) - ${defaultCat.icon}`);
      } else {
        // Update existing category if needed
        let needsUpdate = false;
        
        if (category.color !== defaultCat.color) {
          category.color = defaultCat.color;
          needsUpdate = true;
        }
        if (category.icon !== defaultCat.icon) {
          category.icon = defaultCat.icon;
          needsUpdate = true;
        }
        if (category.isDefault !== defaultCat.isDefault) {
          category.isDefault = defaultCat.isDefault;
          needsUpdate = true;
        }
        if (category.isSystem !== defaultCat.isSystem) {
          category.isSystem = defaultCat.isSystem;
          needsUpdate = true;
        }
        if (defaultCat.description && category.description !== defaultCat.description) {
          category.description = defaultCat.description;
          needsUpdate = true;
        }
        
        if (needsUpdate) {
          await category.save();
          updated++;
          console.log(`🔄 Updated: ${defaultCat.name} (${defaultCat.type})`);
        } else {
          existing++;
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Total categories: ${DEFAULT_CATEGORIES.length}`);
    console.log(`   ✅ Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ✓ Already existed: ${existing}`);
    
    // Show all categories
    console.log('\n📋 All Default Categories:');
    console.log('   Income Categories:');
    DEFAULT_CATEGORIES.filter(c => c.type === 'income').forEach(cat => {
      console.log(`     • ${cat.icon} ${cat.name}`);
    });
    console.log('\n   Expense Categories:');
    DEFAULT_CATEGORIES.filter(c => c.type === 'expense' && !c.isSystem).forEach(cat => {
      console.log(`     • ${cat.icon} ${cat.name}`);
    });
    console.log('\n   System Categories:');
    DEFAULT_CATEGORIES.filter(c => c.isSystem).forEach(cat => {
      console.log(`     • ${cat.icon} ${cat.name} (${cat.description})`);
    });
    
    return { created, updated, existing };
  } catch (error) {
    console.error('❌ Error validating default categories:', error);
    throw error;
  }
}

// If run directly, execute validation
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('Connected to MongoDB');
    return validateDefaultCategories();
  })
  .then(() => {
    console.log('\n✅ Validation completed successfully!');
    return mongoose.connection.close();
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
}

module.exports = validateDefaultCategories;
