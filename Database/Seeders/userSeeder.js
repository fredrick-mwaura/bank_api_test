import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import User from '../../app/Models/User.js'

dotenv.config() //manage env variables

const UserSeeder = async () => {
  try{
    await mongoose.connect(process.env.MONGODB_URI)

    // ---delete existing user
    // await User.deleteMany(); 

    const hashedPassword = await bcrypt.hash("testuser", 10)

    const users = [     
      {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        password: hashedPassword,
        phoneNumber: "0712345678",
        dateOfBirth: new Date("1990-05-14"),
        snn: "123-45-6789",
        address: {
          street: "123 Main St",
          city: "Nairobi",
          state: "Nairobi County",
          zipCode: "00100",
          country: "Kenya"
        },
        accountType: "checking",
        balance: 150000,
        currency: "KES",
        status: "active",
        userId: new mongoose.Types.ObjectId(), // Replace with valid ID if needed
        dailyTransactionLimit: 300000
      },{
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
        password: hashedPassword,
        phoneNumber: "0723456789",
        dateOfBirth: new Date("1988-09-21"),
        snn: "987-65-4321",
        address: {
          street: "456 Side St",
          city: "Mombasa",
          state: "Mombasa County",
          zipCode: "80100",
          country: "Kenya"
        },
        accountType: "savings",
        balance: 50000,
        currency: "KES",
        status: "active",
        userId: new mongoose.Types.ObjectId(),
        dailyTransactionLimit: 500000

      }
    ];

    await User.insertMany(users);

    console.log('user successfully seeded')
    
    process.exit();

  }catch(error){
    console.log('Error in seeding the users, make sure mongoose s running: \n', error);
    process.exit(1);
  }
}

UserSeeder();