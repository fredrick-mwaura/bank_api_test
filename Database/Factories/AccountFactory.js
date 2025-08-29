import { faker } from "@faker-js/faker";
import Account from "../../app/Models/Account.js";
import User from "../../app/Models/User.js";
import db from "../../config/database.js";


const seedAccounts = async () => {
  try {
    await db.connectDB()

    await Account.deleteMany();

    const users = await User.find();
    if (users.length === 0) {
      throw new Error("No users found. Please seed users first.");
    }

    const accounts = [];

    for (const user of users) {
      const accountCount = faker.number.int({ min: 1, max: 3 });
      for (let i = 0; i < accountCount; i++) {
        accounts.push({
          accountNumber: faker.string.numeric(10),
          accountType: faker.helpers.arrayElement(["checking", "savings", "business"]),
          balance: faker.number.int({ min: 0, max: 1000000 }),
          currency: "KES",
          dailyTransactionLimit: faker.number.int({ min: 50000, max: 500000 }),
          status: faker.helpers.arrayElement(["active", "inactive", "frozen"]),
          owner: user._id,
        });
      }
    }

    await Account.insertMany(accounts);

    console.log(`successfully Seeded ${accounts.length} accounts.`);
    process.exit();
  } catch (error) {
    console.error("Error in seeding accounts:", error);
    process.exit(1);
  }
};

seedAccounts();
