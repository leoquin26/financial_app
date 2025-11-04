const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '../../data/finance_pro.db');
const db = new sqlite3.Database(dbPath);

console.log('🧹 Starting category cleanup...\n');

db.serialize(() => {
    // First, let's see what categories we have
    db.all(`SELECT id, name, type, user_id, is_default, 
            (SELECT COUNT(*) FROM transactions WHERE category_id = categories.id) as transaction_count
            FROM categories 
            ORDER BY name, type, id`, (err, categories) => {
        if (err) {
            console.error('Error fetching categories:', err);
            return;
        }

        console.log(`Found ${categories.length} total categories\n`);
        
        // Group categories by name and type
        const categoryGroups = {};
        categories.forEach(cat => {
            const key = `${cat.name}-${cat.type}`;
            if (!categoryGroups[key]) {
                categoryGroups[key] = [];
            }
            categoryGroups[key].push(cat);
        });

        // Find duplicates
        const duplicates = [];
        Object.keys(categoryGroups).forEach(key => {
            if (categoryGroups[key].length > 1) {
                console.log(`Duplicate found: ${key}`);
                categoryGroups[key].forEach(cat => {
                    console.log(`  - ID: ${cat.id}, User: ${cat.user_id || 'NULL'}, Transactions: ${cat.transaction_count}`);
                });
                
                // Keep the one with transactions, or the first one
                const sorted = categoryGroups[key].sort((a, b) => {
                    // Prioritize categories with transactions
                    if (a.transaction_count > 0 && b.transaction_count === 0) return -1;
                    if (b.transaction_count > 0 && a.transaction_count === 0) return 1;
                    // Then prioritize default categories
                    if (a.is_default && !b.is_default) return -1;
                    if (b.is_default && !a.is_default) return 1;
                    // Finally, keep the one with lower ID
                    return a.id - b.id;
                });
                
                // Mark others for deletion
                for (let i = 1; i < sorted.length; i++) {
                    if (sorted[i].transaction_count === 0) {
                        duplicates.push(sorted[i].id);
                    }
                }
            }
        });

        if (duplicates.length > 0) {
            console.log(`\n🗑️  Removing ${duplicates.length} duplicate categories...`);
            
            const placeholders = duplicates.map(() => '?').join(',');
            db.run(`DELETE FROM categories WHERE id IN (${placeholders})`, duplicates, function(err) {
                if (err) {
                    console.error('Error removing duplicates:', err);
                } else {
                    console.log(`✅ Removed ${this.changes} duplicate categories`);
                }
                
                // Show final state
                db.all(`SELECT name, type, COUNT(*) as count 
                        FROM categories 
                        GROUP BY name, type 
                        HAVING count > 1`, (err, remaining) => {
                    if (remaining && remaining.length > 0) {
                        console.log('\n⚠️  Still have duplicates (with transactions):');
                        remaining.forEach(r => {
                            console.log(`  - ${r.name} (${r.type}): ${r.count} copies`);
                        });
                    } else {
                        console.log('\n✅ No more duplicates! Categories are clean.');
                    }
                    
                    // Show category summary
                    db.all(`SELECT type, COUNT(*) as count FROM categories GROUP BY type`, (err, summary) => {
                        console.log('\n📊 Category Summary:');
                        summary.forEach(s => {
                            console.log(`  - ${s.type}: ${s.count} categories`);
                        });
                        
                        db.close();
                    });
                });
            });
        } else {
            console.log('\n✅ No duplicates found! Categories are already clean.');
            
            // Show category summary
            db.all(`SELECT type, COUNT(*) as count FROM categories GROUP BY type`, (err, summary) => {
                console.log('\n📊 Category Summary:');
                summary.forEach(s => {
                    console.log(`  - ${s.type}: ${s.count} categories`);
                });
                
                db.close();
            });
        }
    });
});
