import mongoose from "mongoose";
import AdminLog from "../../app/Models/AdminLogs.js";
import db from "../../config/database.js";

async function seedAdminLogs() {

  db.connectDB()
  await AdminLog.deleteMany({});
  console.log("existing admin logs cleared");

  const logs = [
    {
      adminId: new mongoose.Types.ObjectId(),
      action: "login",
      resource: "dashboard",
      category: "authentication",
      severity: "info",
      metadata: { method: "password" },
      ipAddress: "192.168.1.10",
      userAgent: "Mozilla/5.0",
      sessionId: "sess123",
    },
    {
      adminId: new mongoose.Types.ObjectId(),
      action: "delete_user",
      resource: "user",
      resourceId: new mongoose.Types.ObjectId(),
      category: "user_management",
      severity: "warning",
      metadata: { deletedUserId: "user456" },
      ipAddress: "192.168.1.11",
      userAgent: "Mozilla/5.0",
      sessionId: "sess456",
    },
  ];

  await AdminLog.insertMany(logs);
  console.log("Admin logs seeded!");
  await mongoose.disconnect();
}

seedAdminLogs();