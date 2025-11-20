const mongoose = require('mongoose');
const User = require('../models/User');

async function addPreferencesToExistingUsers() {
    try {
        console.log('🔄 Adding preferences field to existing users...\n');
        
        // Find all users to ensure they have proper preferences
        const users = await User.find({});
        
        console.log(`Found ${users.length} total users to check`);
        
        let updated = 0;
        
        for (const user of users) {
            let needsUpdate = false;
            
            // Check if preferences field exists and has the required properties
            if (!user.preferences) {
                user.preferences = {
                    showFloatingQuickPayment: true,
                    floatingButtonPosition: 'bottom-right',
                    density: 'comfortable'
                };
                needsUpdate = true;
            } else {
                // Ensure the properties exist even if preferences object exists
                if (user.preferences.showFloatingQuickPayment === undefined) {
                    user.preferences.showFloatingQuickPayment = true;
                    needsUpdate = true;
                }
                if (!user.preferences.floatingButtonPosition) {
                    user.preferences.floatingButtonPosition = 'bottom-right';
                    needsUpdate = true;
                }
                if (user.preferences.density === undefined) {
                    user.preferences.density = 'comfortable';
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                await user.save();
                updated++;
                console.log(`✅ Updated user: ${user.username}`);
            } else {
                console.log(`✓ User ${user.username} already has preferences`);
            }
        }
        
        console.log(`\n✅ Successfully updated ${updated} users with default preferences`);
        
    } catch (error) {
        console.error('❌ Error adding preferences to users:', error);
        throw error;
    }
}

// If run directly
if (require.main === module) {
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log('Connected to MongoDB');
        return addPreferencesToExistingUsers();
    })
    .then(() => {
        console.log('\n✅ Migration completed successfully!');
        return mongoose.connection.close();
    })
    .catch(error => {
        console.error('Failed:', error);
        process.exit(1);
    });
}

module.exports = addPreferencesToExistingUsers;
