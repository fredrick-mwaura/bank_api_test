import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from '../../app/Models/User.js'
import {faker} from '@faker-js/faker';
import db from

dotenv.config() //manage env variables

const UserFactory = async () => {
  try{

    await db.connectDB()

    await User.deleteMany(); 

    const hashedPassword = await bcrypt.hash("testuser", 10)

    const users = Array.from({length: 10}).map(()=>({
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email().toLowerCase(),
      password: hashedPassword,
      phoneNumber: faker.phone.number("07########"),
      dateOfBirth: faker.date.birthdate({ min: 18, max: 65, mode: "age" }),
      snn: faker.string.numeric({ length: 9 }), // fake 9-digit number
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        zipCode: faker.location.zipCode(),
        country: faker.location.country()
      },
      accountType: faker.helpers.arrayElement(["checking", "savings", "business"]),
      balance: faker.number.int({ min: 1000, max: 1000000 }),
      currency: "KES",
      status: faker.helpers.arrayElement(["active", "inactive", "frozen"]),
      userId: new mongoose.Types.ObjectId(), // Replace with actual ID if linking to another user
      dailyTransactionLimit: faker.number.int({ min: 50000, max: 500000 })
    }));


    await User.insertMany(users);

    console.log('user seeding successful')
    process.exit();
  }catch(error){
    console.log('error in seeding users', error)
    process.exit(1);
  }
}

UserFactory();