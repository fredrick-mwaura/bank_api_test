import mongoose from "mongoose"
import mongoosePaginate from "mongoose-paginate-v2"

// AuditLog model for comprehensive activity tracking
const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    action: {
      type: String,
      required: true,
      index: true,
    },

    resource: {
      type: String,
      required: true,
      index: true,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    category: {
      type: String,
      enum: [
        "authentication",
        "user_action",
        "financial",
        "account_management",
        "security",
        "admin_action",
        "system",
        "compliance",
      ],
      required: true,
      index: true,
    },

    severity: {
      type: String,
      enum: ["info", "warning", "error", "critical"],
      default: "info",
      index: true,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      index: true,
    },

    userAgent: {
      type: String,
    },

    sessionId: {
      type: String,
      index: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Geographic information
    location: {
      country: String,
      region: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Request information
    requestId: {
      type: String,
      index: true,
    },

    responseStatus: {
      type: Number,
    },

    processingTime: {
      type: Number, // in milliseconds
    },
  },
  {
    timestamps: false, // We use our own timestamp field
    collection: "audit_logs",
  },
)

// Indexes for performance
auditLogSchema.index({ userId: 1, timestamp: -1 })
auditLogSchema.index({ action: 1, timestamp: -1 })
auditLogSchema.index({ category: 1, severity: 1, timestamp: -1 })
auditLogSchema.index({ ipAddress: 1, timestamp: -1 })
auditLogSchema.index({ timestamp: -1 }) // For general sorting
auditLogSchema.index({ resourceId: 1, resource: 1 })

// TTL index for automatic cleanup (keep logs for 7 years for compliance)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 })

// Add pagination plugin
auditLogSchema.plugin(mongoosePaginate)

const AuditLog = mongoose.model("AuditLog", auditLogSchema)

export default AuditLog
