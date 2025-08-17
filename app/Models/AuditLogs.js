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

// Add pagination plugin
auditLogSchema.plugin(mongoosePaginate)

const AuditLog = mongoose.model("AuditLog", auditLogSchema)

export default AuditLog
