const mongoose = require('mongoose');
const Category = require('../models/Category');

async function ensureQuickPaymentCategory() {
    try {
        // Check if Quick Payment category exists
        let quickPaymentCategory = await Category.findOne({
            name: 'Quick Payment',
            isSystem: true
        });

        if (!quickPaymentCategory) {
            // Create the Quick Payment category as a system category
            quickPaymentCategory = await Category.create({
                name: 'Quick Payment',
                type: 'expense',
                color: '#7C3AED', // Purple color to match the quick payment button
                icon: '⚡', // Lightning bolt icon
                isDefault: false,
                userId: null, // System category available to all users
                isSystem: true, // Mark as system category
                description: 'Automatic category for quick payments'
            });
            console.log('✅ Quick Payment category created successfully');
        } else {
            console.log('✅ Quick Payment category already exists');
        }

        return quickPaymentCategory;
    } catch (error) {
        console.error('Error ensuring Quick Payment category:', error);
        throw error;
    }
}

module.exports = ensureQuickPaymentCategory;
