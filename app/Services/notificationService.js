import mongoose from "mongoose"
import Notification from "../Models/Notification.js"
import User from "../Models/User.js"
import * as emailService from "../Services/EmailService.js"
import * as auditService from "../Services/AuditService.js"
import logger from "../utils/logger.js"

// Laravel-style notification service
class NotificationService {

  constructor() {
    this.deliveryMethods = {
      email: this.sendEmailNotification.bind(this),
      sms: this.sendSMSNotification.bind(this),
      push: this.sendPushNotification.bind(this),
      inApp: this.sendInAppNotification.bind(this),
    }

    this.notificationTemplates = {
      // Transaction notifications
      transaction_completed: {
        title: "Transaction Completed",
        priority: "medium",
        channels: ["email", "inApp"],
      },
      transaction_failed: {
        title: "Transaction Failed",
        priority: "high",
        channels: ["email", "sms", "inApp"],
      },
      large_transaction: {
        title: "Large Transaction Alert",
        priority: "high",
        channels: ["email", "sms", "inApp"],
      },

      // Security notifications
      login_new_device: {
        title: "New Device Login",
        priority: "high",
        channels: ["email", "sms", "inApp"],
      },
      password_changed: {
        title: "Password Changed",
        priority: "high",
        channels: ["email", "sms", "inApp"],
      },
      suspicious_activity: {
        title: "Suspicious Activity Detected",
        priority: "urgent",
        channels: ["email", "sms", "inApp", "push"],
      },

      // Account notifications
      account_created: {
        title: "Account Created",
        priority: "medium",
        channels: ["email", "inApp"],
      },
      account_verified: {
        title: "Account Verified",
        priority: "medium",
        channels: ["email", "inApp"],
      },
      account_suspended: {
        title: "Account Suspended",
        priority: "urgent",
        channels: ["email", "sms", "inApp"],
      },

      // System notifications
      maintenance_scheduled: {
        title: "Scheduled Maintenance",
        priority: "medium",
        channels: ["email", "inApp"],
      },
      service_outage: {
        title: "Service Outage",
        priority: "urgent",
        channels: ["email", "sms", "inApp", "push"],
      },

      // Marketing notifications
      promotional_offer: {
        title: "Special Offer",
        priority: "low",
        channels: ["email", "inApp"],
      },
      newsletter: {
        title: "Newsletter",
        priority: "low",
        channels: ["email"],
      },
    }
  }

  // Send notification to user(s)
  async sendNotification({
    userId = null,
    userIds = [],
    type,
    title = null,
    message,
    data = {},
    channels = [],
    priority = "medium",
    scheduledFor = null,
    expiresAt = null,
  }) {
    try {
      // Determine recipients
      const recipients = userId ? [userId] : userIds
      if (!recipients.length) {
        throw new Error("No recipients specified")
      }

      // Get notification template if type is provided
      const template = this.notificationTemplates[type]
      if (template) {
        title = title || template.title
        priority = priority || template.priority
        channels = channels.length ? channels : template.channels
      }

      // Default channels if none specified
      if (!channels.length) {
        channels = ["inApp"]
      }

      const results = []

      // Send to each recipient
      for (const recipientId of recipients) {
        try {
          const result = await this.sendToUser({
            userId: recipientId,
            type,
            title,
            message,
            data,
            channels,
            priority,
            scheduledFor,
            expiresAt,
          })
          results.push(result)
        } catch (error) {
          logger.error(`Failed to send notification to user ${recipientId}:`, error)
          results.push({
            userId: recipientId,
            success: false,
            error: error.message,
          })
        }
      }

      return results
    } catch (error) {
      logger.error("Send notification error:", error)
      throw error
    }
  }

  // Send notification to a single user
  async sendToUser({
    userId,
    type,
    title,
    message,
    data = {},
    channels = ["inApp"],
    priority = "medium",
    scheduledFor = null,
    expiresAt = null,
  }) {
    try {
      // Get user and preferences
      const user = await User.findById(userId).select("preferences email phoneNumber firstName lastName")
      if (!user) {
        throw new Error("User not found")
      }

      // Check user notification preferences
      const filteredChannels = this.filterChannelsByPreferences(channels, user.preferences)

      if (!filteredChannels.length) {
        logger.info(`No enabled channels for user ${userId}, skipping notification`)
        return {
          userId,
          success: true,
          message: "Notification skipped due to user preferences",
          channels: [],
        }
      }

      // Create notification record
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        data,
        channels: filteredChannels,
        priority,
        scheduledFor: scheduledFor || new Date(),
        expiresAt,
        status: scheduledFor ? "scheduled" : "pending",
      })

      await notification.save()

      // Send immediately if not scheduled
      if (!scheduledFor || scheduledFor <= new Date()) {
        await this.deliverNotification(notification, user)
      }

      return {
        userId,
        success: true,
        notificationId: notification._id,
        channels: filteredChannels,
      }
    } catch (error) {
      logger.error(`Send to user error for ${userId}:`, error)
      throw error
    }
  }

  // Deliver notification through specified channels
  async deliverNotification(notification, user = null) {
    try {
      if (!user) {
        user = await User.findById(notification.userId).select("preferences email phoneNumber firstName lastName")
      }

      const deliveryResults = []

      // Deliver through each channel
      for (const channel of notification.channels) {
        try {
          const deliveryMethod = this.deliveryMethods[channel]
          if (deliveryMethod) {
            const result = await deliveryMethod(notification, user)
            deliveryResults.push({
              channel,
              success: true,
              result,
            })
          } else {
            deliveryResults.push({
              channel,
              success: false,
              error: `Unknown delivery method: ${channel}`,
            })
          }
        } catch (error) {
          logger.error(`Delivery failed for channel ${channel}:`, error)
          deliveryResults.push({
            channel,
            success: false,
            error: error.message,
          })
        }
      }

      // Update notification status
      const successfulDeliveries = deliveryResults.filter((r) => r.success).length
      const status = successfulDeliveries > 0 ? "delivered" : "failed"

      await Notification.findByIdAndUpdate(notification._id, {
        status,
        deliveredAt: successfulDeliveries > 0 ? new Date() : null,
        deliveryResults,
        deliveryAttempts: (notification.deliveryAttempts || 0) + 1,
      })

      return deliveryResults
    } catch (error) {
      logger.error("Deliver notification error:", error)
      throw error
    }
  }

  // Email delivery method
  async sendEmailNotification(notification, user) {
    try {
      const emailData = {
        firstName: user.firstName,
        lastName: user.lastName,
        notification: {
          title: notification.title,
          message: notification.message,
          type: notification.type,
          priority: notification.priority,
          data: notification.data,
        },
      }

      // Use specific email template based on notification type
      const templateMap = {
        transaction_completed: "transaction-notification",
        transaction_failed: "transaction-notification",
        login_new_device: "security-new-device",
        password_changed: "security-password-changed",
        account_created: "account-created",
        maintenance_scheduled: "maintenance",
        promotional_offer: "promotional",
      }

      const template = templateMap[notification.type] || "generic-notification"

      const result = await emailService.sendTemplateEmail(user.email, notification.title, template, emailData)

      return {
        messageId: result.messageId,
        template,
      }
    } catch (error) {
      logger.error("Email notification error:", error)
      throw error
    }
  }

  // SMS delivery method (placeholder - would integrate with SMS service)
  async sendSMSNotification(notification, user) {
    try {
      // This would integrate with an SMS service like Twilio, AWS SNS, etc.
      logger.info(`SMS notification sent to ${user.phoneNumber}:`, {
        title: notification.title,
        message: notification.message,
      })

      return {
        provider: "placeholder",
        phoneNumber: user.phoneNumber,
        message: notification.message,
      }
    } catch (error) {
      logger.error("SMS notification error:", error)
      throw error
    }
  }

  // Push notification delivery method (placeholder)
  async sendPushNotification(notification, user) {
    try {
      // This would integrate with push notification services like FCM, APNS, etc.
      logger.info(`Push notification sent to user ${user._id}:`, {
        title: notification.title,
        message: notification.message,
      })

      return {
        provider: "placeholder",
        userId: user._id,
        title: notification.title,
        message: notification.message,
      }
    } catch (error) {
      logger.error("Push notification error:", error)
      throw error
    }
  }

  // In-app notification delivery method
  async sendInAppNotification(notification, user) {
    try {
      // In-app notifications are stored in the database and shown in the UI
      // The notification record itself serves as the in-app notification
      return {
        notificationId: notification._id,
        stored: true,
      }
    } catch (error) {
      logger.error("In-app notification error:", error)
      throw error
    }
  }

  // Filter channels based on user preferences
  filterChannelsByPreferences(channels, preferences) {
    if (!preferences || !preferences.notifications) {
      return channels
    }

    const userPrefs = preferences.notifications
    return channels.filter((channel) => {
      switch (channel) {
        case "email":
          return userPrefs.email !== false
        case "sms":
          return userPrefs.sms === true
        case "push":
          return userPrefs.push !== false
        case "inApp":
          return true // Always allow in-app notifications
        default:
          return true
      }
    })
  }

  // Send transaction notification
  async sendTransactionNotification({ userId, type, transaction, account }) {
    try {
      const messages = {
        transfer_sent: `Transfer of ${this.formatCurrency(transaction.amount)} sent successfully`,
        transfer_received: `You received ${this.formatCurrency(transaction.amount)}`,
        deposit_received: `Deposit of ${this.formatCurrency(transaction.amount)} received`,
        withdrawal_completed: `Withdrawal of ${this.formatCurrency(transaction.amount)} completed`,
        payment_completed: `Payment of ${this.formatCurrency(transaction.amount)} completed`,
      }

      const message = messages[type] || `Transaction ${type} completed`

      await this.sendNotification({
        userId,
        type: "transaction_completed",
        title: "Transaction Update",
        message,
        data: {
          transactionId: transaction._id,
          amount: transaction.amount,
          accountNumber: account.accountNumber,
          balance: account.balance,
        },
        priority: transaction.amount > 10000 ? "high" : "medium",
      })

      // Send email notification separately for transaction confirmations
      await emailService.sendTransactionNotification((await User.findById(userId)).email, {
        type,
        amount: transaction.amount,
        description: transaction.description,
        accountNumber: account.accountNumber,
        balance: account.balance,
        timestamp: transaction.createdAt,
        transactionId: transaction.transactionId,
      })
    } catch (error) {
      logger.error("Send transaction notification error:", error)
      throw error
    }
  }

  // Send security alert
  async sendSecurityAlert({ userId, type, ipAddress, location, action }) {
    try {
      const messages = {
        login_new_device: "New device login detected",
        login_new_location: "Login from new location detected",
        password_changed: "Your password has been changed",
        suspicious_activity: "Suspicious activity detected on your account",
        account_locked: "Your account has been temporarily locked",
      }

      const message = messages[type] || "Security alert"

      await this.sendNotification({
        userId,
        type,
        title: "Security Alert",
        message,
        data: {
          ipAddress,
          location,
          action,
          timestamp: new Date(),
        },
        priority: "high",
        channels: ["email", "sms", "inApp"],
      })

      // Send detailed security email
      const user = await User.findById(userId)
      await emailService.sendSecurityAlert(user.email, {
        type,
        ipAddress,
        location,
        timestamp: new Date(),
        action,
        firstName: user.firstName,
      })
    } catch (error) {
      logger.error("Send security alert error:", error)
      throw error
    }
  }

  // Send account notification
  async sendAccountNotification({ userId, type, accountData, message }) {
    try {
      await this.sendNotification({
        userId,
        type,
        title: "Account Update",
        message,
        data: accountData,
        priority: type.includes("suspended") || type.includes("closed") ? "urgent" : "medium",
      })

      // Send detailed account email
      const user = await User.findById(userId)
      await emailService.sendAccountNotification(user.email, {
        type,
        accountNumber: accountData.accountNumber,
        accountType: accountData.accountType,
        message,
        firstName: user.firstName,
      })
    } catch (error) {
      logger.error("Send account notification error:", error)
      throw error
    }
  }

  // Send system notification
  async sendSystemNotification({ type, title, message, data = {}, userIds = [], priority = "medium" }) {
    try {
      // If no specific users, send to all active users
      if (!userIds.length) {
        const users = await User.find({ status: "active" }).select("_id")
        userIds = users.map((user) => user._id)
      }

      await this.sendNotification({
        userIds,
        type,
        title,
        message,
        data,
        priority,
        channels: ["email", "inApp"],
      })
    } catch (error) {
      logger.error("Send system notification error:", error)
      throw error
    }
  }

  // Get user notifications with pagination
  async getUserNotifications(userId, { page = 1, limit = 20, type, read, priority } = {}) {
    try {
      const filters = { userId }
      if (type) filters.type = type
      if (read !== undefined) filters.read = read
      if (priority) filters.priority = priority

      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { createdAt: -1 },
      }

      const result = await Notification.paginate(filters, options)
      return result
    } catch (error) {
      logger.error("Get user notifications error:", error)
      throw error
    }
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true, readAt: new Date() },
        { new: true },
      )

      if (!notification) {
        throw new Error("Notification not found")
      }

      return notification
    } catch (error) {
      logger.error("Mark as read error:", error)
      throw error
    }
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany({ userId, read: false }, { read: true, readAt: new Date() })

      return result
    } catch (error) {
      logger.error("Mark all as read error:", error)
      throw error
    }
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    try {
      const result = await Notification.deleteOne({ _id: notificationId, userId })
      return result
    } catch (error) {
      logger.error("Delete notification error:", error)
      throw error
    }
  }

  // Clear all notifications for a user
  async clearAllNotifications(userId) {
    try {
      const result = await Notification.deleteMany({ userId })
      return result
    } catch (error) {
      logger.error("Clear all notifications error:", error)
      throw error
    }
  }

  // Process scheduled notifications
  async processScheduledNotifications() {
    try {
      const scheduledNotifications = await Notification.find({
        status: "scheduled",
        scheduledFor: { $lte: new Date() },
      }).populate("userId", "preferences email phoneNumber firstName lastName")

      for (const notification of scheduledNotifications) {
        try {
          await this.deliverNotification(notification, notification.userId)
          logger.info(`Processed scheduled notification ${notification._id}`)
        } catch (error) {
          logger.error(`Failed to process scheduled notification ${notification._id}:`, error)
        }
      }

      return scheduledNotifications.length
    } catch (error) {
      logger.error("Process scheduled notifications error:", error)
      throw error
    }
  }

  // Retry failed notifications
  async retryFailedNotifications(maxAttempts = 3) {
    try {
      const failedNotifications = await Notification.find({
        status: "failed",
        deliveryAttempts: { $lt: maxAttempts },
      }).populate("userId", "preferences email phoneNumber firstName lastName")

      for (const notification of failedNotifications) {
        try {
          await this.deliverNotification(notification, notification.userId)
          logger.info(`Retried failed notification ${notification._id}`)
        } catch (error) {
          logger.error(`Failed to retry notification ${notification._id}:`, error)
        }
      }

      return failedNotifications.length
    } catch (error) {
      logger.error("Retry failed notifications error:", error)
      throw error
    }
  }

  // Clean up expired notifications
  async cleanupExpiredNotifications() {
    try {
      const result = await Notification.deleteMany({
        expiresAt: { $lt: new Date() },
      })

      logger.info(`Cleaned up ${result.deletedCount} expired notifications`)
      return result.deletedCount
    } catch (error) {
      logger.error("Cleanup expired notifications error:", error)
      throw error
    }
  }

  // Get notification statistics
  async getNotificationStats(userId = null) {
    try {
      const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {}

      const stats = await Notification.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            unread: {
              $sum: { $cond: [{ $eq: ["$read", false] }, 1, 0] },
            },
            byType: {
              $push: {
                type: "$type",
                priority: "$priority",
                read: "$read",
              },
            },
            byStatus: {
              $push: "$status",
            },
          },
        },
      ])

      return stats[0] || { total: 0, unread: 0, byType: [], byStatus: [] }
    } catch (error) {
      logger.error("Get notification stats error:", error)
      throw error
    }
  }

  // Utility methods
  formatCurrency(amount, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount)
  }

  // Broadcast notification to all users
  async broadcastNotification({ type, title, message, data = {}, priority = "medium", excludeUserIds = [] }) {
    try {
      const users = await User.find({
        status: "active",
        _id: { $nin: excludeUserIds },
      }).select("_id")

      const userIds = users.map((user) => user._id)

      const results = await this.sendNotification({
        userIds,
        type,
        title,
        message,
        data,
        priority,
        channels: ["email", "inApp"],
      })

      // Log broadcast
      await auditService.logSystemEvent({
        action: "notification_broadcast",
        component: "notification_service",
        metadata: {
          type,
          title,
          recipientCount: userIds.length,
          priority,
        },
      })

      return results
    } catch (error) {
      logger.error("Broadcast notification error:", error)
      throw error
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService()

// Export individual methods for convenience
export const sendNotification = notificationService.sendNotification.bind(notificationService)
export const sendTransactionNotification = notificationService.sendTransactionNotification.bind(notificationService)
export const sendSecurityAlert = notificationService.sendSecurityAlert.bind(notificationService)
export const sendAccountNotification = notificationService.sendAccountNotification.bind(notificationService)
export const sendSystemNotification = notificationService.sendSystemNotification.bind(notificationService)
export const getUserNotifications = notificationService.getUserNotifications.bind(notificationService)
export const markAsRead = notificationService.markAsRead.bind(notificationService)
export const markAllAsRead = notificationService.markAllAsRead.bind(notificationService)
export const deleteNotification = notificationService.deleteNotification.bind(notificationService)
export const clearAllNotifications = notificationService.clearAllNotifications.bind(notificationService)
export const processScheduledNotifications = notificationService.processScheduledNotifications.bind(notificationService)
export const retryFailedNotifications = notificationService.retryFailedNotifications.bind(notificationService)
export const cleanupExpiredNotifications = notificationService.cleanupExpiredNotifications.bind(notificationService)
export const getNotificationStats = notificationService.getNotificationStats.bind(notificationService)
export const broadcastNotification = notificationService.broadcastNotification.bind(notificationService)

// Export the service instance as default
export default notificationService
