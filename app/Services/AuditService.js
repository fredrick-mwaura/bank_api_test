import mongoose from "mongoose"
import AuditLog from "../models/AuditLog.js"
import logger from "../utils/logger.js"

// Laravel-style audit service for comprehensive activity logging
class AuditService {
  // Log user activity with comprehensive metadata
  async logActivity({
    userId = null,
    action,
    resource,
    resourceId = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
    sessionId = null,
    severity = "info",
    category = "user_action",
  }) {
    try {
      const auditEntry = new AuditLog({
        userId: userId ? new mongoose.Types.ObjectId(userId) : null,
        action,
        resource,
        resourceId: resourceId ? new mongoose.Types.ObjectId(resourceId) : null,
        metadata,
        ipAddress,
        userAgent,
        sessionId,
        severity,
        category,
        timestamp: new Date(),
      })

      await auditEntry.save()

      // Log to application logger as well
      logger.info("Audit log created", {
        userId,
        action,
        resource,
        resourceId,
        ipAddress,
        severity,
      })

      return auditEntry
    } catch (error) {
      logger.error("Failed to create audit log:", error)
      // Don't throw error to prevent breaking main application flow
      return null
    }
  }

  // Log authentication events
  async logAuthEvent({
    userId = null,
    action,
    success = true,
    email = null,
    ipAddress = null,
    userAgent = null,
    metadata = {},
  }) {
    const authMetadata = {
      success,
      email,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    return this.logActivity({
      userId,
      action,
      resource: "authentication",
      metadata: authMetadata,
      ipAddress,
      userAgent,
      severity: success ? "info" : "warning",
      category: "authentication",
    })
  }

  // Log transaction events
  async logTransactionEvent({
    userId,
    transactionId,
    action,
    amount = null,
    fromAccount = null,
    toAccount = null,
    status = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
  }) {
    const transactionMetadata = {
      transactionId,
      amount,
      fromAccount,
      toAccount,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    return this.logActivity({
      userId,
      action,
      resource: "transaction",
      resourceId: transactionId,
      metadata: transactionMetadata,
      ipAddress,
      userAgent,
      severity: "info",
      category: "financial",
    })
  }

  // Log account events
  async logAccountEvent({
    userId,
    accountId,
    action,
    accountType = null,
    balance = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
  }) {
    const accountMetadata = {
      accountType,
      balance,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    return this.logActivity({
      userId,
      action,
      resource: "account",
      resourceId: accountId,
      metadata: accountMetadata,
      ipAddress,
      userAgent,
      severity: "info",
      category: "account_management",
    })
  }

  // Log security events
  async logSecurityEvent({
    userId = null,
    action,
    severity = "warning",
    threatLevel = "low",
    ipAddress = null,
    userAgent = null,
    metadata = {},
  }) {
    const securityMetadata = {
      threatLevel,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    return this.logActivity({
      userId,
      action,
      resource: "security",
      metadata: securityMetadata,
      ipAddress,
      userAgent,
      severity,
      category: "security",
    })
  }

  // Log admin actions
  async logAdminAction({
    adminUserId,
    targetUserId = null,
    action,
    resource,
    resourceId = null,
    changes = {},
    ipAddress = null,
    userAgent = null,
  }) {
    const adminMetadata = {
      adminUserId,
      targetUserId,
      changes,
      timestamp: new Date().toISOString(),
    }

    return this.logActivity({
      userId: adminUserId,
      action,
      resource,
      resourceId,
      metadata: adminMetadata,
      ipAddress,
      userAgent,
      severity: "info",
      category: "admin_action",
    })
  }

  // Log system events
  async logSystemEvent({ action, component, status = "success", metadata = {}, severity = "info" }) {
    const systemMetadata = {
      component,
      status,
      timestamp: new Date().toISOString(),
      ...metadata,
    }

    return this.logActivity({
      action,
      resource: "system",
      metadata: systemMetadata,
      severity,
      category: "system",
    })
  }

  // Get audit logs with filtering
  async getAuditLogs({
    userId = null,
    action = null,
    resource = null,
    category = null,
    severity = null,
    startDate = null,
    endDate = null,
    ipAddress = null,
    page = 1,
    limit = 50,
  }) {
    try {
      const filters = {}

      if (userId) filters.userId = new mongoose.Types.ObjectId(userId)
      if (action) filters.action = action
      if (resource) filters.resource = resource
      if (category) filters.category = category
      if (severity) filters.severity = severity
      if (ipAddress) filters.ipAddress = ipAddress

      if (startDate || endDate) {
        filters.timestamp = {}
        if (startDate) filters.timestamp.$gte = new Date(startDate)
        if (endDate) filters.timestamp.$lte = new Date(endDate)
      }

      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { timestamp: -1 },
        populate: [
          {
            path: "userId",
            select: "firstName lastName email",
          },
        ],
      }

      const result = await AuditLog.paginate(filters, options)
      return result
    } catch (error) {
      logger.error("Failed to fetch audit logs:", error)
      throw error
    }
  }

  // Get user activity summary
  async getUserActivitySummary(userId, days = 30) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const summary = await AuditLog.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              action: "$action",
              resource: "$resource",
              category: "$category",
            },
            count: { $sum: 1 },
            lastActivity: { $max: "$timestamp" },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])

      return summary
    } catch (error) {
      logger.error("Failed to get user activity summary:", error)
      throw error
    }
  }

  // Get security events summary
  async getSecurityEventsSummary(days = 7) {
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const summary = await AuditLog.aggregate([
        {
          $match: {
            category: "security",
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              action: "$action",
              severity: "$severity",
            },
            count: { $sum: 1 },
            lastOccurrence: { $max: "$timestamp" },
            affectedUsers: { $addToSet: "$userId" },
          },
        },
        {
          $addFields: {
            affectedUserCount: { $size: "$affectedUsers" },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])

      return summary
    } catch (error) {
      logger.error("Failed to get security events summary:", error)
      throw error
    }
  }

  // Detect suspicious activity patterns
  async detectSuspiciousActivity(userId, hours = 24) {
    try {
      const startDate = new Date()
      startDate.setHours(startDate.getHours() - hours)

      const suspiciousPatterns = await AuditLog.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            timestamp: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              action: "$action",
              ipAddress: "$ipAddress",
            },
            count: { $sum: 1 },
            timestamps: { $push: "$timestamp" },
          },
        },
        {
          $match: {
            count: { $gte: 10 }, // More than 10 similar actions
          },
        },
        {
          $sort: { count: -1 },
        },
      ])

      // Check for multiple IP addresses
      const ipAddresses = await AuditLog.distinct("ipAddress", {
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: { $gte: startDate },
      })

      return {
        suspiciousPatterns,
        multipleIPs: ipAddresses.length > 3,
        ipAddresses,
      }
    } catch (error) {
      logger.error("Failed to detect suspicious activity:", error)
      throw error
    }
  }

  // Generate compliance report
  async generateComplianceReport(startDate, endDate) {
    try {
      const report = await AuditLog.aggregate([
        {
          $match: {
            timestamp: {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          },
        },
        {
          $group: {
            _id: {
              category: "$category",
              action: "$action",
              date: {
                $dateToString: {
                  format: "%Y-%m-%d",
                  date: "$timestamp",
                },
              },
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: "$userId" },
          },
        },
        {
          $addFields: {
            uniqueUserCount: { $size: "$uniqueUsers" },
          },
        },
        {
          $sort: {
            "_id.date": -1,
            "_id.category": 1,
            "_id.action": 1,
          },
        },
      ])

      return report
    } catch (error) {
      logger.error("Failed to generate compliance report:", error)
      throw error
    }
  }

  // Clean up old audit logs
  async cleanupOldLogs(retentionDays = 365) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await AuditLog.deleteMany({
        timestamp: { $lt: cutoffDate },
        category: { $nin: ["security", "financial"] }, // Keep security and financial logs longer
      })

      logger.info(`Cleaned up ${result.deletedCount} old audit logs`)
      return result.deletedCount
    } catch (error) {
      logger.error("Failed to cleanup old audit logs:", error)
      throw error
    }
  }

  // Export audit logs for compliance
  async exportAuditLogs(filters = {}, format = "json") {
    try {
      const logs = await AuditLog.find(filters)
        .populate("userId", "firstName lastName email")
        .sort({ timestamp: -1 })
        .lean()

      if (format === "csv") {
        // Convert to CSV format
        const csv = this.convertToCSV(logs)
        return csv
      }

      return logs
    } catch (error) {
      logger.error("Failed to export audit logs:", error)
      throw error
    }
  }

  // Helper method to convert logs to CSV
  convertToCSV(logs) {
    if (!logs.length) return ""

    const headers = [
      "Timestamp",
      "User ID",
      "User Name",
      "Action",
      "Resource",
      "Category",
      "Severity",
      "IP Address",
      "User Agent",
      "Metadata",
    ]

    const csvRows = [headers.join(",")]

    logs.forEach((log) => {
      const row = [
        log.timestamp?.toISOString() || "",
        log.userId?._id || "",
        log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : "",
        log.action || "",
        log.resource || "",
        log.category || "",
        log.severity || "",
        log.ipAddress || "",
        log.userAgent || "",
        JSON.stringify(log.metadata || {}),
      ]

      csvRows.push(row.map((field) => `"${field}"`).join(","))
    })

    return csvRows.join("\n")
  }
}

// Create singleton instance
const auditService = new AuditService()

// Export individual methods for convenience
export const logActivity = auditService.logActivity.bind(auditService)
export const logAuthEvent = auditService.logAuthEvent.bind(auditService)
export const logTransactionEvent = auditService.logTransactionEvent.bind(auditService)
export const logAccountEvent = auditService.logAccountEvent.bind(auditService)
export const logSecurityEvent = auditService.logSecurityEvent.bind(auditService)
export const logAdminAction = auditService.logAdminAction.bind(auditService)
export const logSystemEvent = auditService.logSystemEvent.bind(auditService)
export const getAuditLogs = auditService.getAuditLogs.bind(auditService)
export const getUserActivitySummary = auditService.getUserActivitySummary.bind(auditService)
export const getSecurityEventsSummary = auditService.getSecurityEventsSummary.bind(auditService)
export const detectSuspiciousActivity = auditService.detectSuspiciousActivity.bind(auditService)
export const generateComplianceReport = auditService.generateComplianceReport.bind(auditService)
export const cleanupOldLogs = auditService.cleanupOldLogs.bind(auditService)
export const exportAuditLogs = auditService.exportAuditLogs.bind(auditService)

// Export the service instance as default
export default auditService
