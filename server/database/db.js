const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(path.join(dataDir, 'finance_pro.db'));

// Database initialization
const initialize = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                full_name TEXT,
                avatar_url TEXT,
                currency TEXT DEFAULT 'PEN',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error('Error creating users table:', err);
            });

            // Categories table with user association
            db.run(`CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT NOT NULL,
                type TEXT CHECK(type IN ('expense', 'income')),
                color TEXT,
                icon TEXT,
                is_default BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, name, type)
            )`, (err) => {
                if (err) console.error('Error creating categories table:', err);
            });

            // Transactions table with enhanced features
            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                category_id INTEGER,
                description TEXT,
                date DATE NOT NULL,
                type TEXT CHECK(type IN ('expense', 'income')),
                payment_method TEXT,
                location TEXT,
                tags TEXT,
                receipt_url TEXT,
                is_recurring BOOLEAN DEFAULT 0,
                recurring_period TEXT,
                person TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            )`, (err) => {
                if (err) console.error('Error creating transactions table:', err);
            });

            // Budgets table with alerts
            db.run(`CREATE TABLE IF NOT EXISTS budgets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                category_id INTEGER,
                amount REAL NOT NULL,
                period TEXT DEFAULT 'monthly',
                start_date DATE,
                end_date DATE,
                alert_percentage INTEGER DEFAULT 80,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            )`, (err) => {
                if (err) console.error('Error creating budgets table:', err);
            });

            // Goals table for savings goals
            db.run(`CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                target_amount REAL NOT NULL,
                current_amount REAL DEFAULT 0,
                deadline DATE,
                color TEXT,
                icon TEXT,
                is_achieved BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error('Error creating goals table:', err);
            });

            // Notifications table
            db.run(`CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                message TEXT,
                is_read BOOLEAN DEFAULT 0,
                data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`, (err) => {
                if (err) console.error('Error creating notifications table:', err);
            });

            // Create indexes for better performance
            db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
                    ON transactions(user_id, date DESC)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category 
                    ON transactions(category_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_budgets_user_active 
                    ON budgets(user_id, is_active)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
                    ON notifications(user_id, is_read)`);

            // Clean up duplicate categories first (keep only one per name/type combination)
            db.run(`DELETE FROM categories 
                    WHERE id NOT IN (
                        SELECT MIN(id) 
                        FROM categories 
                        GROUP BY COALESCE(user_id, 0), name, type
                    )`, (err) => {
                if (err) console.error('Error cleaning duplicates:', err);
            });

            // Insert default categories
            const defaultCategories = [
                // Expenses - Essential categories from your notes
                { name: 'Alquiler', type: 'expense', color: '#FF6384', icon: '🏠' },
                { name: 'Cochera', type: 'expense', color: '#36A2EB', icon: '🚗' },
                { name: 'Carro', type: 'expense', color: '#FFCE56', icon: '🚙' },
                { name: 'Préstamo', type: 'expense', color: '#4BC0C0', icon: '💳' },
                { name: 'Servicios', type: 'expense', color: '#9966FF', icon: '💡' },
                { name: 'Internet', type: 'expense', color: '#FF9F40', icon: '🌐' },
                { name: 'Palma', type: 'expense', color: '#FF9F40', icon: '🌴' },
                { name: 'Gym', type: 'expense', color: '#FF6384', icon: '💪' },
                { name: 'Comida', type: 'expense', color: '#36A2EB', icon: '🍔' },
                { name: 'Guardería', type: 'expense', color: '#9966FF', icon: '👶' },
                { name: 'Odontología', type: 'expense', color: '#FF9F40', icon: '🦷' },
                { name: 'Transporte', type: 'expense', color: '#00BCD4', icon: '🚌' },
                { name: 'Salud', type: 'expense', color: '#009688', icon: '🏥' },
                { name: 'Otros Gastos', type: 'expense', color: '#607D8B', icon: '📋' },
                // Income
                { name: 'Salario', type: 'income', color: '#4CAF50', icon: '💰' },
                { name: 'Comisión', type: 'income', color: '#8BC34A', icon: '💵' },
                { name: 'Ahorro', type: 'income', color: '#00BCD4', icon: '🏦' },
                { name: 'Otros Ingresos', type: 'income', color: '#FFC107', icon: '💸' }
            ];

            // Only insert categories that don't exist
            defaultCategories.forEach(cat => {
                db.run(`INSERT OR IGNORE INTO categories (user_id, name, type, color, icon, is_default) 
                        VALUES (NULL, ?, ?, ?, ?, 1)`,
                    [cat.name, cat.type, cat.color, cat.icon],
                    (err) => {
                        if (err) console.error('Error inserting category:', cat.name, err);
                    }
                );
            });

            // Create demo user for testing
            const demoPassword = bcrypt.hashSync('demo123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, email, password, full_name) 
                    VALUES (?, ?, ?, ?)`,
                ['demo', 'demo@example.com', demoPassword, 'Usuario Demo'],
                (err) => {
                    if (err) {
                        console.error('Error creating demo user:', err);
                        reject(err);
                    } else {
                        console.log('Database initialized successfully');
                        resolve();
                    }
                });
        });
    });
};

// Helper function to run queries with promises
const runQuery = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

const getAll = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getOne = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

module.exports = {
    db,
    initialize,
    runQuery,
    getAll,
    getOne
};
