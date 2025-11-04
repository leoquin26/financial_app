const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// Database setup
const db = new sqlite3.Database(path.join(dataDir, 'finance.db'));

// Create tables
db.serialize(() => {
    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT CHECK(type IN ('expense', 'income')),
        color TEXT,
        icon TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Transactions table
    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category_id INTEGER,
        description TEXT,
        date DATE NOT NULL,
        type TEXT CHECK(type IN ('expense', 'income')),
        person TEXT,
        is_recurring BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id)
    )`);

    // Budgets table
    db.run(`CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        amount REAL NOT NULL,
        month TEXT NOT NULL,
        year INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories (id),
        UNIQUE(category_id, month, year)
    )`);

    // Insert default categories if they don't exist
    const defaultCategories = [
        // Expenses
        { name: 'Alquiler', type: 'expense', color: '#FF6384', icon: '🏠' },
        { name: 'Cochera', type: 'expense', color: '#36A2EB', icon: '🚗' },
        { name: 'Carro', type: 'expense', color: '#FFCE56', icon: '🚙' },
        { name: 'Préstamo', type: 'expense', color: '#4BC0C0', icon: '💳' },
        { name: 'Servicios', type: 'expense', color: '#9966FF', icon: '💡' },
        { name: 'Palma', type: 'expense', color: '#FF9F40', icon: '🌴' },
        { name: 'Gym', type: 'expense', color: '#FF6384', icon: '💪' },
        { name: 'Comida', type: 'expense', color: '#36A2EB', icon: '🍔' },
        { name: 'Higiene', type: 'expense', color: '#FFCE56', icon: '🧼' },
        { name: 'Perros', type: 'expense', color: '#4BC0C0', icon: '🐕' },
        { name: 'Guardería', type: 'expense', color: '#9966FF', icon: '👶' },
        { name: 'Odontología', type: 'expense', color: '#FF9F40', icon: '🦷' },
        // Income
        { name: 'Salario', type: 'income', color: '#4CAF50', icon: '💰' },
        { name: 'Comisión', type: 'income', color: '#8BC34A', icon: '💵' },
        { name: 'Ahorro', type: 'income', color: '#00BCD4', icon: '🏦' },
        { name: 'Otros', type: 'income', color: '#FFC107', icon: '💸' }
    ];

    defaultCategories.forEach(cat => {
        db.run(`INSERT OR IGNORE INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)`,
            [cat.name, cat.type, cat.color, cat.icon]);
    });
});

// API Routes

// Get all categories
app.get('/api/categories', (req, res) => {
    db.all("SELECT * FROM categories ORDER BY type DESC, name", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add new category
app.post('/api/categories', (req, res) => {
    const { name, type, color, icon } = req.body;
    db.run(`INSERT INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)`,
        [name, type, color, icon],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, name, type, color, icon });
        }
    );
});

// Get all transactions with filters
app.get('/api/transactions', (req, res) => {
    const { month, year, type, person } = req.query;
    let query = `
        SELECT t.*, c.name as category_name, c.color, c.icon 
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE 1=1
    `;
    const params = [];

    if (month && year) {
        query += ` AND strftime('%m', t.date) = ? AND strftime('%Y', t.date) = ?`;
        params.push(month.padStart(2, '0'), year);
    }
    if (type) {
        query += ` AND t.type = ?`;
        params.push(type);
    }
    if (person) {
        query += ` AND t.person = ?`;
        params.push(person);
    }

    query += ` ORDER BY t.date DESC, t.created_at DESC`;

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Add new transaction
app.post('/api/transactions', (req, res) => {
    const { amount, category_id, description, date, type, person, is_recurring } = req.body;
    db.run(`INSERT INTO transactions (amount, category_id, description, date, type, person, is_recurring) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [amount, category_id, description, date, type, person, is_recurring || 0],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

// Update transaction
app.put('/api/transactions/:id', (req, res) => {
    const { amount, category_id, description, date, type, person, is_recurring } = req.body;
    db.run(`UPDATE transactions 
            SET amount = ?, category_id = ?, description = ?, date = ?, type = ?, person = ?, is_recurring = ?
            WHERE id = ?`,
        [amount, category_id, description, date, type, person, is_recurring || 0, req.params.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: req.params.id, ...req.body });
        }
    );
});

// Delete transaction
app.delete('/api/transactions/:id', (req, res) => {
    db.run(`DELETE FROM transactions WHERE id = ?`, req.params.id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ deleted: true });
    });
});

// Get summary statistics
app.get('/api/summary', (req, res) => {
    const { month, year } = req.query;
    let dateFilter = '';
    const params = [];

    if (month && year) {
        dateFilter = ` WHERE strftime('%m', date) = ? AND strftime('%Y', date) = ?`;
        params.push(month.padStart(2, '0'), year, ...params);
    }

    const queries = {
        totalIncome: `SELECT COALESCE(SUM(amount), 0) as total FROM transactions${dateFilter} AND type = 'income'`,
        totalExpenses: `SELECT COALESCE(SUM(amount), 0) as total FROM transactions${dateFilter} AND type = 'expense'`,
        expensesByCategory: `
            SELECT c.name, c.color, c.icon, COALESCE(SUM(t.amount), 0) as total
            FROM categories c
            LEFT JOIN transactions t ON c.id = t.category_id ${dateFilter ? 'AND' + dateFilter.substring(6) : ''}
            WHERE c.type = 'expense' ${dateFilter ? '' : 'AND t.id IS NOT NULL'}
            GROUP BY c.id, c.name, c.color, c.icon
            ORDER BY total DESC
        `,
        expensesByPerson: `
            SELECT person, COALESCE(SUM(amount), 0) as total
            FROM transactions
            ${dateFilter}
            ${dateFilter ? 'AND' : 'WHERE'} type = 'expense' AND person IS NOT NULL AND person != ''
            GROUP BY person
            ORDER BY total DESC
        `
    };

    const results = {};
    let completed = 0;

    Object.keys(queries).forEach(key => {
        db.all(queries[key], params, (err, rows) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            results[key] = key.includes('total') ? rows[0].total : rows;
            completed++;
            if (completed === Object.keys(queries).length) {
                results.balance = results.totalIncome - results.totalExpenses;
                res.json(results);
            }
        });
    });
});

// Get budgets
app.get('/api/budgets', (req, res) => {
    const { month, year } = req.query;
    let query = `
        SELECT b.*, c.name as category_name, c.color, c.icon,
               COALESCE(SUM(t.amount), 0) as spent
        FROM budgets b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN transactions t ON c.id = t.category_id 
            AND strftime('%m', t.date) = b.month 
            AND strftime('%Y', t.date) = CAST(b.year AS TEXT)
        WHERE 1=1
    `;
    const params = [];

    if (month && year) {
        query += ` AND b.month = ? AND b.year = ?`;
        params.push(month.padStart(2, '0'), year);
    }

    query += ` GROUP BY b.id ORDER BY c.name`;

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Set budget
app.post('/api/budgets', (req, res) => {
    const { category_id, amount, month, year } = req.body;
    db.run(`INSERT OR REPLACE INTO budgets (category_id, amount, month, year) VALUES (?, ?, ?, ?)`,
        [category_id, amount, month.padStart(2, '0'), year],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID, ...req.body });
        }
    );
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
