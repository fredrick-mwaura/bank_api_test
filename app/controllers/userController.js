import User from "../Models/User.js"
import * as auditService from "../Services/AuditService.js"
import logger from "../utils/logger.js"

// Laravel-style user controller
class UserController {
  // Get current user profile
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id).select("-password")

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      res.status(200).json({
        status: "success",
        data: { user },
      })
    } catch (error) {
      logger.error("Get profile error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch profile",
      })
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const userId = req.user._id
      const updates = req.body

      // Remove sensitive fields that shouldn't be updated via this endpoint
      delete updates.password
      delete updates.email
      delete updates.role
      delete updates.status
      delete updates.ssn

      const user = await User.findByIdAndUpdate(userId, updates, {
        new: true,
        runValidators: true,
      }).select("-password")

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      // Log profile update
      await auditService.logActivity({
        userId,
        action: "profile_updated",
        resource: "user",
        resourceId: userId,
        metadata: { updatedFields: Object.keys(updates) },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
        data: { user },
      })
    } catch (error) {
      logger.error("Update profile error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to update profile",
      })
    }
  }

  // Get user preferences
  async getPreferences(req, res) {
    try {
      const user = await User.findById(req.user._id).select("preferences")

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      res.status(200).json({
        status: "success",
        data: { preferences: user.preferences },
      })
    } catch (error) {
      logger.error("Get preferences error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch preferences",
      })
    }
  }

  // Update user preferences
  async updatePreferences(req, res) {
    try {
      const userId = req.user._id
      const preferences = req.body

      const user = await User.findByIdAndUpdate(userId, { preferences }, { new: true, runValidators: true }).select(
        "preferences",
      )

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      // Log preferences update
      await auditService.logActivity({
        userId,
        action: "preferences_updated",
        resource: "user",
        resourceId: userId,
        metadata: { preferences },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "Preferences updated successfully",
        data: { preferences: user.preferences },
      })
    } catch (error) {
      logger.error("Update preferences error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to update preferences",
      })
    }
  }

  // Get user notifications
  async getNotifications(req, res) {
    try {
      const userId = req.user._id
      const { page = 1, limit = 20, type, read, priority } = req.query

      // Build filters
      const filters = { userId }
      if (type) filters.type = type
      if (read !== undefined) filters.read = read === "true"
      if (priority) filters.priority = priority

      // This would typically use a Notification model
      // For now, return a placeholder response
      res.status(200).json({
        status: "success",
        data: {
          notifications: [],
          pagination: {
            currentPage: Number.parseInt(page),
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: Number.parseInt(limit),
          },
        },
      })
    } catch (error) {
      logger.error("Get notifications error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch notifications",
      })
    }
  }

  // Mark notification as read
  async markNotificationAsRead(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id

      // This would typically update a Notification model
      // For now, return a success response
      res.status(200).json({
        status: "success",
        message: "Notification marked as read",
      })
    } catch (error) {
      logger.error("Mark notification as read error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to mark notification as read",
      })
    }
  }

  // Mark all notifications as read
  async markAllNotificationsAsRead(req, res) {
    try {
      const userId = req.user._id

      // This would typically update all user notifications
      // For now, return a success response
      res.status(200).json({
        status: "success",
        message: "All notifications marked as read",
      })
    } catch (error) {
      logger.error("Mark all notifications as read error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to mark all notifications as read",
      })
    }
  }

  // Get user activity log
  async getActivityLog(req, res) {
    try {
      const userId = req.user._id
      const { page = 1, limit = 20 } = req.query

      const activityLogs = await auditService.getAuditLogs({
        userId,
        page,
        limit,
      })

      res.status(200).json({
        status: "success",
        data: activityLogs,
      })
    } catch (error) {
      logger.error("Get activity log error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch activity log",
      })
    }
  }

  // Admin: Get all users
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 20, status, role, search, startDate, endDate } = req.query

      // Build filters
      const filters = {}
      if (status) filters.status = status
      if (role) filters.role = role
      if (search) {
        filters.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ]
      }
      if (startDate || endDate) {
        filters.createdAt = {}
        if (startDate) filters.createdAt.$gte = new Date(startDate)
        if (endDate) filters.createdAt.$lte = new Date(endDate)
      }

      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { createdAt: -1 },
        select: "-password -ssn",
      }

      const result = await User.paginate(filters, options)

      res.status(200).json({
        status: "success",
        data: {
          users: result.docs,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalDocs,
            itemsPerPage: result.limit,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
          },
        },
      })
    } catch (error) {
      logger.error("Get all users error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch users",
      })
    }
  }

  // Admin: Get user by ID
  async getUserById(req, res) {
    try {
      const { id } = req.params

      const user = await User.findById(id).select("-password")

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      res.status(200).json({
        status: "success",
        data: { user },
      })
    } catch (error) {
      logger.error("Get user by ID error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch user",
      })
    }
  }

  // Admin: Update user status
  async updateUserStatus(req, res) {
    try {
      const { id } = req.params
      const { status, reason } = req.body
      const adminUserId = req.user._id

      const user = await User.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).select("-password")

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      // Log admin action
      await auditService.logAdminAction({
        adminUserId,
        targetUserId: id,
        action: "user_status_updated",
        resource: "user",
        resourceId: id,
        changes: { status, reason },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "User status updated successfully",
        data: { user },
      })
    } catch (error) {
      logger.error("Update user status error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to update user status",
      })
    }
  }

  // Admin: Delete user
  async deleteUser(req, res) {
    try {
      const { id } = req.params
      const adminUserId = req.user._id

      const user = await User.findById(id)

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      // Soft delete by updating status
      user.status = "closed"
      await user.save()

      // Log admin action
      await auditService.logAdminAction({
        adminUserId,
        targetUserId: id,
        action: "user_deleted",
        resource: "user",
        resourceId: id,
        changes: { status: "closed" },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "User deleted successfully",
      })
    } catch (error) {
      logger.error("Delete user error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to delete user",
      })
    }
  }

  // Admin: Get user statistics
  async getUserStats(req, res) {
    try {
      const stats = await User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
            },
            inactiveUsers: {
              $sum: { $cond: [{ $eq: ["$status", "inactive"] }, 1, 0] },
            },
            suspendedUsers: {
              $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] },
            },
            verifiedUsers: {
              $sum: { $cond: ["$isEmailVerified", 1, 0] },
            },
          },
        },
      ])

      const result = stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        inactiveUsers: 0,
        suspendedUsers: 0,
        verifiedUsers: 0,
      }

      res.status(200).json({
        status: "success",
        data: { stats: result },
      })
    } catch (error) {
      logger.error("Get user stats error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch user statistics",
      })
    }
  }

  // Admin: Get registration statistics
  async getRegistrationStats(req, res) {
    try {
      const { period = "30d" } = req.query

      const startDate = new Date()
      switch (period) {
        case "7d":
          startDate.setDate(startDate.getDate() - 7)
          break
        case "30d":
          startDate.setDate(startDate.getDate() - 30)
          break
        case "90d":
          startDate.setDate(startDate.getDate() - 90)
          break
        case "1y":
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
        default:
          startDate.setDate(startDate.getDate() - 30)
      }

      const registrationStats = await User.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ])

      res.status(200).json({
        status: "success",
        data: { registrationStats },
      })
    } catch (error) {
      logger.error("Get registration stats error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch registration statistics",
      })
    }
  }
}

// Create and export controller instance
const userController = new UserController()

export const getProfile = userController.getProfile.bind(userController)
export const updateProfile = userController.updateProfile.bind(userController)
export const getPreferences = userController.getPreferences.bind(userController)
export const updatePreferences = userController.updatePreferences.bind(userController)
export const getNotifications = userController.getNotifications.bind(userController)
export const markNotificationAsRead = userController.markNotificationAsRead.bind(userController)
export const markAllNotificationsAsRead = userController.markAllNotificationsAsRead.bind(userController)
export const getActivityLog = userController.getActivityLog.bind(userController)
export const getAllUsers = userController.getAllUsers.bind(userController)
export const getUserById = userController.getUserById.bind(userController)
export const updateUserStatus = userController.updateUserStatus.bind(userController)
export const deleteUser = userController.deleteUser.bind(userController)
export const getUserStats = userController.getUserStats.bind(userController)
export const getRegistrationStats = userController.getRegistrationStats.bind(userController)

export default userController
