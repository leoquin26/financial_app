const mongoose = require('mongoose');
const WeeklyBudget = require('../models/WeeklyBudget');
const Category = require('../models/Category');
require('dotenv').config();

async function fixDuplicateQuickPaymentCategories() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app');
        console.log('Connected to database');

        // Find the Quick Payment category
        const quickPaymentCategory = await Category.findOne({
            name: 'Quick Payment',
            isSystem: true
        });

        if (!quickPaymentCategory) {
            console.error('Quick Payment category not found');
            return;
        }

        console.log('Quick Payment category ID:', quickPaymentCategory._id);

        // Find all weekly budgets
        const budgets = await WeeklyBudget.find({}).populate('categories.categoryId');
        
        let fixedCount = 0;

        for (const budget of budgets) {
            // Find all Quick Payment categories in this budget
            const quickPaymentEntries = budget.categories.filter(cat => {
                const categoryId = typeof cat.categoryId === 'object' 
                    ? (cat.categoryId._id || cat.categoryId.id || cat.categoryId).toString()
                    : cat.categoryId.toString();
                return categoryId === quickPaymentCategory._id.toString();
            });

            if (quickPaymentEntries.length > 1) {
                console.log(`\nBudget ${budget._id} has ${quickPaymentEntries.length} Quick Payment categories`);
                
                // Merge all payments into the first Quick Payment category
                const mainCategory = quickPaymentEntries[0];
                let totalAllocation = mainCategory.allocation || 0;
                
                for (let i = 1; i < quickPaymentEntries.length; i++) {
                    const dupCategory = quickPaymentEntries[i];
                    
                    // Add payments from duplicate to main
                    if (dupCategory.payments && dupCategory.payments.length > 0) {
                        mainCategory.payments.push(...dupCategory.payments);
                        console.log(`  - Merged ${dupCategory.payments.length} payments from duplicate category`);
                    }
                    
                    // Add allocation from duplicate to main
                    if (dupCategory.allocation) {
                        totalAllocation += dupCategory.allocation;
                    }
                    
                    // Remove the duplicate category from the budget
                    const index = budget.categories.findIndex(cat => cat._id.toString() === dupCategory._id.toString());
                    if (index > -1) {
                        budget.categories.splice(index, 1);
                        console.log(`  - Removed duplicate category with _id: ${dupCategory._id}`);
                    }
                }
                
                // Update the main category's allocation
                mainCategory.allocation = totalAllocation;
                console.log(`  - Set total allocation to: ${totalAllocation}`);
                console.log(`  - Main category now has ${mainCategory.payments.length} payments`);
                
                // Mark as modified and save
                budget.markModified('categories');
                await budget.save();
                fixedCount++;
            }
        }

        console.log(`\n✅ Fixed ${fixedCount} budgets with duplicate Quick Payment categories`);

        // Verify the fix
        console.log('\nVerifying fix...');
        const verifyBudgets = await WeeklyBudget.find({}).populate('categories.categoryId');
        
        for (const budget of verifyBudgets) {
            const quickPaymentEntries = budget.categories.filter(cat => {
                const categoryId = typeof cat.categoryId === 'object' 
                    ? (cat.categoryId._id || cat.categoryId.id || cat.categoryId).toString()
                    : cat.categoryId.toString();
                return categoryId === quickPaymentCategory._id.toString();
            });

            if (quickPaymentEntries.length > 1) {
                console.warn(`⚠️ Budget ${budget._id} still has ${quickPaymentEntries.length} Quick Payment categories!`);
            } else if (quickPaymentEntries.length === 1) {
                const qpCat = quickPaymentEntries[0];
                console.log(`✓ Budget ${budget._id}: 1 Quick Payment category with ${qpCat.payments.length} payments, allocation: ${qpCat.allocation}`);
            }
        }

    } catch (error) {
        console.error('Error fixing duplicate Quick Payment categories:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Database connection closed');
    }
}

// Run the fix
fixDuplicateQuickPaymentCategories();
