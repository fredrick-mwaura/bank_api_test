import Privates from "../../app/Models/PrivateApis.js";
import db from "../../config/database.js";
import { config } from "../../config/index.js";

export const PrivateSeeder = async () => {
  await db.connectDB()

  const privateKeys = [
    {
      name: "ipstack",
      description: "get geolocation",
      key: config.privates.ipstack
    }
  ]

  await Privates.insertMany(privateKeys)
    .then(()=>{
      console.log("seeder exited successfully")
      process.exit(0)
    })
}

PrivateSeeder()