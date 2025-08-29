import mongoose from 'mongoose'
import Transaction from '../../app/Models/Transaction.js'
import Account from '../../app/Models/Account.js'
import {faker} from '@faker-js/faker';
import db from '../../config/database.js'


const TransactionFactory = async () => {
  try{
    await db.connectDB()

    await Transaction.deleteMany({})

    let accounts = await Account.find()
    if(accounts.length < 1){
      throw new Error("No account found. seed account first")
    }   

    const transactions = Array.from({ length: 20 }).map(() => {
      const fromAcc = faker.helpers.arrayElement(accounts);
      let toAcc = null;

      const type = faker.helpers.arrayElement([
        "deposit",
        "withdrawal",
        "transfer",
        "payment",
      ]);
      if (type === "transfer" || type === "payment") {
        toAcc = faker.helpers.arrayElement(
          accounts.filter((acc) => acc._id.toString() !== fromAcc._id.toString())
        );
      }

      const amount = faker.number.float({ min: 100, max: 100000, precision: 0.01 });

      return {
        transactionId: faker.string.uuid(),
        type,
        amount,
        description: faker.finance.transactionDescription(),
        fromAccount: fromAcc._id,
        toAccount: toAcc ? toAcc._id : undefined,
        status: faker.helpers.arrayElement([
          "pending",
          "completed",
          "failed",
          "canceled",
        ]),
        balanceAfter:
          fromAcc.balance - amount >= 0
            ? fromAcc.balance - amount
            : fromAcc.balance, // avoid negative balance
      };
    });

    await Transaction.insertMany(transactions)

    console.log("Transaction seeding successful!")
    process.exit();

  }catch(error){
    console.log('error in seeding Transaction db', error)
    process.exit(1)
  }
}

TransactionFactory();