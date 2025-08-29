import mongoose from "mongoose";
import Admin from "../../app/Models/Admin.js";

async function seedAdmins() {
  await mongoose.connect("mongodb://localhost:27017/banking_api");

  await Admin.deleteMany({});
  console.log("existing admins cleared");

  const admins = [
    {
      email: "superadmin@example.com",
      name: "Super Admin",
      phone: "+2547234567890",
      userId: new mongoose.Types.ObjectId(),
      role: "superadmin",
      permissions: ["manage_users", "view_logs", "edit_settings"],
      active: true,
    },
    {
      email: "admin@example.com",
      name: "Admin User",
      phone: "+254787654321",
      userId: new mongoose.Types.ObjectId(),
      role: "admin",
      permissions: ["view_logs"],
      active: true,
    },
    {
      email: "mod@example.com",
      name: "Moderator",
      phone: "+2549033493242",
      userId: new mongoose.Types.ObjectId(),
      role: "moderator",
      permissions: [],
      active: true,
    },
  ];

  await Admin.insertMany(admins);
  console.log("Admins seeded!");
  await mongoose.disconnect();
}

seedAdmins();