const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

// Import MongoDB models
const User = require('../models/User');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const Notification = require('../models/Notification');

// SQLite database path
const SQLITE_DB_PATH = path.join(__dirname, '../../data/finance.db');

async function migrateData() {
    try {
        console.log('🚀 Starting migration from SQLite to MongoDB...\n');
        
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Connected to MongoDB');
        
        // Open SQLite database
        const sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('❌ Error opening SQLite database:', err);
                process.exit(1);
            }
        });
        console.log('✅ Connected to SQLite database\n');
        
        // Ask for confirmation
        console.log('⚠️  WARNING: This will clear existing MongoDB data!');
        console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Clear existing MongoDB data
        console.log('🗑️  Clearing existing MongoDB data...');
        await User.deleteMany({});
        await Category.deleteMany({});
        await Transaction.deleteMany({});
        await Budget.deleteMany({});
        await Notification.deleteMany({});
        console.log('✅ MongoDB collections cleared\n');
        
        // Migrate Users
        console.log('👤 Migrating users...');
        const users = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM users', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const userIdMap = {}; // Map old IDs to new MongoDB IDs
        
        for (const user of users) {
            const newUser = await User.create({
                username: user.username,
                email: user.email,
                password: user.password, // Already hashed
                createdAt: new Date(user.created_at)
            });
            userIdMap[user.id] = newUser._id;
            console.log(`  ✓ User: ${user.username}`);
        }
        console.log(`✅ Migrated ${users.length} users\n`);
        
        // Migrate Categories
        console.log('📁 Migrating categories...');
        const categories = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM categories', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const categoryIdMap = {}; // Map old IDs to new MongoDB IDs
        
        for (const category of categories) {
            const newCategory = await Category.create({
                name: category.name,
                type: category.type,
                color: category.color || '#808080',
                icon: category.icon || '📁',
                userId: category.user_id ? userIdMap[category.user_id] : null,
                createdAt: new Date(category.created_at)
            });
            categoryIdMap[category.id] = newCategory._id;
            console.log(`  ✓ Category: ${category.name} (${category.type})`);
        }
        console.log(`✅ Migrated ${categories.length} categories\n`);
        
        // Migrate Transactions
        console.log('💰 Migrating transactions...');
        const transactions = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM transactions', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        let transactionCount = 0;
        for (const transaction of transactions) {
            if (!userIdMap[transaction.user_id] || !categoryIdMap[transaction.category_id]) {
                console.log(`  ⚠️  Skipping transaction with invalid references`);
                continue;
            }
            
            await Transaction.create({
                userId: userIdMap[transaction.user_id],
                type: transaction.type,
                amount: transaction.amount,
                categoryId: categoryIdMap[transaction.category_id],
                description: transaction.description || '',
                date: new Date(transaction.date),
                createdAt: new Date(transaction.created_at),
                updatedAt: new Date(transaction.updated_at || transaction.created_at)
            });
            transactionCount++;
            
            if (transactionCount % 10 === 0) {
                console.log(`  ✓ Migrated ${transactionCount} transactions...`);
            }
        }
        console.log(`✅ Migrated ${transactionCount} transactions\n`);
        
        // Migrate Budgets
        console.log('📊 Migrating budgets...');
        const budgets = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM budgets', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const budget of budgets) {
            if (!userIdMap[budget.user_id] || !categoryIdMap[budget.category_id]) {
                console.log(`  ⚠️  Skipping budget with invalid references`);
                continue;
            }
            
            await Budget.create({
                userId: userIdMap[budget.user_id],
                categoryId: categoryIdMap[budget.category_id],
                amount: budget.amount,
                period: budget.period,
                startDate: new Date(budget.start_date),
                endDate: new Date(budget.end_date),
                alertThreshold: budget.alert_threshold || 80,
                alertEnabled: budget.alert_enabled === 1,
                isActive: budget.is_active === 1,
                createdAt: new Date(budget.created_at),
                updatedAt: new Date(budget.updated_at || budget.created_at)
            });
            console.log(`  ✓ Budget for category ID ${budget.category_id}`);
        }
        console.log(`✅ Migrated ${budgets.length} budgets\n`);
        
        // Migrate Notifications
        console.log('🔔 Migrating notifications...');
        const notifications = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM notifications', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const notification of notifications) {
            if (!userIdMap[notification.user_id]) {
                console.log(`  ⚠️  Skipping notification with invalid user reference`);
                continue;
            }
            
            let data = {};
            try {
                data = JSON.parse(notification.data || '{}');
            } catch (e) {
                data = {};
            }
            
            await Notification.create({
                userId: userIdMap[notification.user_id],
                type: notification.type,
                title: notification.title,
                message: notification.message,
                data: data,
                isRead: notification.is_read === 1,
                createdAt: new Date(notification.created_at)
            });
        }
        console.log(`✅ Migrated ${notifications.length} notifications\n`);
        
        // Close connections
        sqliteDb.close();
        await mongoose.connection.close();
        
        console.log('🎉 Migration completed successfully!');
        console.log('\n📝 Summary:');
        console.log(`  - Users: ${users.length}`);
        console.log(`  - Categories: ${categories.length}`);
        console.log(`  - Transactions: ${transactionCount}`);
        console.log(`  - Budgets: ${budgets.length}`);
        console.log(`  - Notifications: ${notifications.length}`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateData();
