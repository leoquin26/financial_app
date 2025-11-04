const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const dbPath = path.join(__dirname, '../../data/finance_pro.db');
const db = new sqlite3.Database(dbPath);

console.log('📬 Creating test notifications...\n');

const testNotifications = [
    {
        user_id: 5, // Assuming user ID 5 exists
        type: 'budget_alert',
        title: 'Alerta: Comida',
        message: 'Has gastado el 85% de tu presupuesto de Comida (425€ de 500€)',
        data: JSON.stringify({ categoryId: 9, percentage: 85, spent: 425, budget: 500 }),
        is_read: 0
    },
    {
        user_id: 5,
        type: 'transaction',
        title: 'Ingreso Importante',
        message: 'Has recibido un ingreso de 1500.00€ en Salario',
        data: JSON.stringify({ transactionId: 1, amount: 1500, categoryId: 19 }),
        is_read: 0
    },
    {
        user_id: 5,
        type: 'goal_achieved',
        title: 'Meta Alcanzada',
        message: '¡Felicidades! Has alcanzado tu meta de ahorro mensual',
        data: JSON.stringify({ goalId: 1, amount: 500 }),
        is_read: 0
    },
    {
        user_id: 5,
        type: 'budget_alert',
        title: 'Alerta: Transporte',
        message: 'Has gastado el 95% de tu presupuesto de Transporte (190€ de 200€)',
        data: JSON.stringify({ categoryId: 14, percentage: 95, spent: 190, budget: 200 }),
        is_read: 1
    },
    {
        user_id: 5,
        type: 'transaction',
        title: 'Gasto Importante',
        message: 'Has registrado un gasto de 650.00€ en Alquiler',
        data: JSON.stringify({ transactionId: 2, amount: 650, categoryId: 1 }),
        is_read: 1
    }
];

db.serialize(() => {
    // Clear existing notifications for user 5
    db.run('DELETE FROM notifications WHERE user_id = 5', (err) => {
        if (err) {
            console.error('Error clearing notifications:', err);
            return;
        }
        
        console.log('Cleared existing notifications for user 5\n');
        
        // Insert test notifications
        const stmt = db.prepare(`
            INSERT INTO notifications (user_id, type, title, message, data, is_read, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' minutes'))
        `);
        
        testNotifications.forEach((notif, index) => {
            // Stagger creation times so they appear in different order
            const minutesAgo = index * 30;
            stmt.run(
                notif.user_id,
                notif.type,
                notif.title,
                notif.message,
                notif.data,
                notif.is_read,
                minutesAgo,
                function(err) {
                    if (err) {
                        console.error('Error inserting notification:', err);
                    } else {
                        console.log(`✅ Created ${notif.type} notification: "${notif.title}"`);
                    }
                }
            );
        });
        
        stmt.finalize(() => {
            // Show summary
            db.get('SELECT COUNT(*) as total, SUM(is_read = 0) as unread FROM notifications WHERE user_id = 5', 
                (err, row) => {
                    if (row) {
                        console.log(`\n📊 Summary:`);
                        console.log(`   Total notifications: ${row.total}`);
                        console.log(`   Unread notifications: ${row.unread}`);
                    }
                    
                    db.close();
                    console.log('\n✨ Test notifications created successfully!');
                    console.log('Login with demo user (demo/demo123) to see them.');
                }
            );
        });
    });
});
