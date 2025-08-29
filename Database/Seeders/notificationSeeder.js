import mongoose from "mongoose";
import Notification from "../../app/Models/Notification.js";
import db from "../../config/database.js";

const NotificationSeeder = async () => {
  try {
    await db.connectDB()

    const users = [
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId(),
      new mongoose.Types.ObjectId()
    ];

    // Create fake notifications
    const notifications = [
      {
        userId: users[0],
        message: 'Your order has been shipped',
        isRead: false
      },
      {
        userId: users[0],
        message: 'Your password was changed successfully',
        isRead: true
      },
      {
        userId: users[1],
        message: 'You have a new message from John',
        isRead: false
      },
      {
        userId: users[2],
        message: 'Your subscription will expire soon',
        isRead: false
      }
    ]

    const notification = await Notification.insertMany(notifications)
    console.log("notifications successfully seeded", notification);
  }catch (error) {
    console.error('Error seeding notifications:', error);
    return
  }
}

NotificationSeeder()