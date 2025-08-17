import mongoose from "mongoose"
// Complementary UserSession model for additional session tracking
const userSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    refreshTokenId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefreshToken",
      required: true,
    },

    // Session activity
    loginAt: {
      type: Date,
      default: Date.now,
      required: true,
    },

    lastActivityAt: {
      type: Date,
      default: Date.now,
    },

    logoutAt: {
      type: Date,
    },

    // Session metadata
    ipAddress: {
      type: String,
      required: true,
    },

    userAgent: {
      type: String,
      required: true,
    },

    // Activity tracking
    pageViews: {
      type: Number,
      default: 0,
    },

    actionsPerformed: [
      {
        action: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        metadata: mongoose.Schema.Types.Mixed,
      },
    ],

    // Session status
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "terminated"],
      default: "active",
      index: true,
    },

    // Security events
    securityEvents: [
      {
        type: {
          type: String,
          enum: ["login", "logout", "password_change", "suspicious_activity", "location_change"],
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: mongoose.Schema.Types.Mixed,
      },
    ],
  },
  {
    timestamps: true,
    collection: "user_sessions",
  },
)

// Indexes
userSessionSchema.index({ userId: 1, status: 1 })
userSessionSchema.index({ sessionId: 1 }, { unique: true })
userSessionSchema.index({ lastActivityAt: 1 })
userSessionSchema.index({ loginAt: -1 })

// Virtual for session duration
userSessionSchema.virtual("duration").get(function () {
  const endTime = this.logoutAt || this.lastActivityAt || new Date()
  return Math.floor((endTime - this.loginAt) / 1000) // in seconds
})

// Instance methods
userSessionSchema.methods.updateActivity = function () {
  this.lastActivityAt = new Date()
  this.pageViews += 1
  return this.save()
}

userSessionSchema.methods.addAction = function (action, metadata = {}) {
  this.actionsPerformed.push({
    action,
    metadata,
    timestamp: new Date(),
  })
  this.lastActivityAt = new Date()
  return this.save()
}

userSessionSchema.methods.addSecurityEvent = function (type, details = {}) {
  this.securityEvents.push({
    type,
    details,
    timestamp: new Date(),
  })
  return this.save()
}

userSessionSchema.methods.terminate = function (reason = "user_logout") {
  this.status = "terminated"
  this.logoutAt = new Date()
  this.addSecurityEvent("logout", { reason })
  return this.save()
}

// Static methods
userSessionSchema.statics.getActiveSessions = function (userId) {
  return this.find({
    userId,
    status: "active",
  }).sort({ lastActivityAt: -1 })
}

userSessionSchema.statics.terminateUserSessions = function (userId, excludeSessionId = null) {
  const query = {
    userId,
    status: "active",
  }

  if (excludeSessionId) {
    query.sessionId = { $ne: excludeSessionId }
  }

  return this.updateMany(query, {
    $set: {
      status: "terminated",
      logoutAt: new Date(),
    },
  })
}

const UserSession = mongoose.model("UserSession", userSessionSchema)

export default UserSession
