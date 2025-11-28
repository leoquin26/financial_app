/**
 * Cleanup Duplicate Transactions Script
 * Removes duplicate transactions that are linked to the same PaymentSchedule
 * Keeps the most recent transaction
 * 
 * Usage: node scripts/cleanupDuplicateTransactions.js [--dry-run]
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/financial_app';
const isDryRun = process.argv.includes('--dry-run');

async function cleanupDuplicates() {
  console.log(`🧹 Starting Duplicate Transaction Cleanup ${isDryRun ? '(DRY RUN)' : ''}...\n`);
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const Transaction = require('../models/Transaction');

    // Find all transactions with paymentScheduleId
    const transactionsWithPaymentId = await Transaction.find({ 
      paymentScheduleId: { $exists: true, $ne: null } 
    }).sort({ createdAt: -1 }); // Most recent first

    // Group by paymentScheduleId
    const groupedByPaymentId = {};
    transactionsWithPaymentId.forEach(t => {
      const id = t.paymentScheduleId.toString();
      if (!groupedByPaymentId[id]) {
        groupedByPaymentId[id] = [];
      }
      groupedByPaymentId[id].push(t);
    });

    // Find duplicates
    const duplicateGroups = Object.entries(groupedByPaymentId)
      .filter(([_, transactions]) => transactions.length > 1);

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate transactions found!\n');
      return;
    }

    console.log(`Found ${duplicateGroups.length} PaymentSchedules with duplicate transactions:\n`);

    let totalDeleted = 0;

    for (const [paymentScheduleId, transactions] of duplicateGroups) {
      console.log(`\n📝 PaymentSchedule: ${paymentScheduleId}`);
      console.log(`   Total transactions: ${transactions.length}`);
      
      // Keep the first one (most recent due to sort)
      const toKeep = transactions[0];
      const toDelete = transactions.slice(1);

      console.log(`   Keeping: ${toKeep._id} (created: ${toKeep.createdAt})`);
      console.log(`   Deleting: ${toDelete.map(t => t._id).join(', ')}`);

      if (!isDryRun) {
        for (const transaction of toDelete) {
          await Transaction.findByIdAndDelete(transaction._id);
          console.log(`   ✅ Deleted: ${transaction._id}`);
          totalDeleted++;
        }
      } else {
        totalDeleted += toDelete.length;
      }
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`   Duplicate groups found: ${duplicateGroups.length}`);
    console.log(`   Transactions ${isDryRun ? 'to delete' : 'deleted'}: ${totalDeleted}`);
    
    if (isDryRun && totalDeleted > 0) {
      console.log(`\n⚠️ This was a DRY RUN. Run without --dry-run to apply changes.`);
    }
    
    console.log('');

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanupDuplicates();

