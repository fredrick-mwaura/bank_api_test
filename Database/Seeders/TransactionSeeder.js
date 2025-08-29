import db from '../../config/database.js';
import dotenv from 'dotenv';
import Transaction from '../../app/Models/Transaction.js';
import Account from '../../app/Models/Account.js'; // make sure you have this model

dotenv.config();

const seedTransactions = async () => {
  try {
    await db.connectDB()

    const accounts = await Account.find().limit(2);
    if (accounts.length < 2) {
      throw new Error('Need at least 2 accounts in DB to seed transactions');
    }

    // Clear existing transactions
    await Transaction.deleteMany({});
    console.log('Old transactions cleared');

    // Create seed data
    const transactions = [
      {
        transactionId: 'TXN-' + Date.now() + '-001',
        type: 'deposit',
        amount: 500,
        description: 'Initial deposit',
        fromAccount: accounts[0]._id,
        balanceAfter: 1500,
        status: 'completed'
      },
      {
        transactionId: 'TXN-' + Date.now() + '-002',
        type: 'withdrawal',
        amount: 200,
        description: 'ATM withdrawal',
        fromAccount: accounts[0]._id,
        balanceAfter: 1300,
        status: 'completed'
      },
      {
        transactionId: 'TXN-' + Date.now() + '-003',
        type: 'transfer',
        amount: 100,
        description: 'Transfer to friend',
        fromAccount: accounts[0]._id,
        toAccount: accounts[1]._id,
        balanceAfter: 1200,
        status: 'pending'
      },
      {
        transactionId: 'TXN-' + Date.now() + '-004',
        type: 'payment',
        amount: 50,
        description: 'Utility bill payment',
        fromAccount: accounts[1]._id,
        balanceAfter: 950,
        status: 'completed'
      }
    ];

    // Insert into DB
    await Transaction.insertMany(transactions);
    console.log('Transactions seeded successfully!');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding transactions:', error);
    process.exit(1);
  }
};

seedTransactions();
