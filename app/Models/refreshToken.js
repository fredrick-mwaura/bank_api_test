const mongoose = require("mongoose")
const mongoosePaginate = require("mongoose-paginate-v2")

// Laravel-style RefreshToken model for session management
const refreshTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    // Device and location information
    ipAddress: {
      type: String,
      required: true,
    },

    userAgent: {
      type: String,
      required: true,
    },

    // Device fingerprinting for security
    deviceFingerprint: {
      type: String,
      index: true,
    },

    // Session metadata
    sessionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Token status
    status: {
      type: String,
      enum: ["active", "revoked", "expired"],
      default: "active",
      index: true,
    },

    // Security flags
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },

    revokedAt: {
      type: Date,
    },

    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    revokedReason: {
      type: String,
      enum: ["user_logout", "admin_revoke", "security_breach", "password_change", "suspicious_activity"],
    },

    // Usage tracking
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },

    usageCount: {
      type: Number,
      default: 0,
    },

    // Geographic information
    location: {
      country: String,
      region: String,
      city: String,
      timezone: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },

    // Device information
    device: {
      type: {
        type: String,
        enum: ["desktop", "mobile", "tablet", "unknown"],
        default: "unknown",
      },
      os: String,
      browser: String,
      version: String,
      isMobile: {
        type: Boolean,
        default: false,
      },
    },

    // Security metadata
    securityFlags: {
      isSuspicious: {
        type: Boolean,
        default: false,
      },
      riskScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
      },
      isNewDevice: {
        type: Boolean,
        default: true,
      },
      isNewLocation: {
        type: Boolean,
        default: true,
      },
    },

    // Remember me functionality
    isRememberMe: {
      type: Boolean,
      default: false,
    },

    // Token family for rotation
    tokenFamily: {
      type: String,
      index: true,
    },

    // Parent token (for token rotation)
    parentToken: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefreshToken",
    },
  },
  {
    timestamps: true,
    collection: "refresh_tokens",
  },
)

// Indexes for performance and security
refreshTokenSchema.index({ token: 1 }, { unique: true })
refreshTokenSchema.index({ userId: 1, status: 1 })
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index
refreshTokenSchema.index({ ipAddress: 1, createdAt: -1 })
refreshTokenSchema.index({ deviceFingerprint: 1, userId: 1 })
refreshTokenSchema.index({ tokenFamily: 1, createdAt: -1 })
refreshTokenSchema.index({ "securityFlags.isSuspicious": 1, status: 1 })

// Compound indexes for common queries
refreshTokenSchema.index({ userId: 1, expiresAt: 1, status: 1 })
refreshTokenSchema.index({ userId: 1, ipAddress: 1, createdAt: -1 })

// Virtual for checking if token is expired
refreshTokenSchema.virtual("isExpired").get(function () {
  return this.expiresAt < new Date()
})

// Virtual for checking if token is valid
refreshTokenSchema.virtual("isValid").get(function () {
  return !this.isRevoked && !this.isExpired && this.status === "active"
})

// Virtual for session duration
refreshTokenSchema.virtual("sessionDuration").get(function () {
  if (this.lastUsedAt && this.createdAt) {
    return Math.floor((this.lastUsedAt - this.createdAt) / 1000) // in seconds
  }
  return 0
})

// Pre-save middleware
refreshTokenSchema.pre("save", function (next) {
  // Generate session ID if not provided
  if (!this.sessionId && this.isNew) {
    this.sessionId = require("crypto").randomBytes(16).toString("hex")
  }

  // Generate token family for rotation if not provided
  if (!this.tokenFamily && this.isNew) {
    this.tokenFamily = require("crypto").randomBytes(8).toString("hex")
  }

  // Update status based on expiration
  if (this.expiresAt < new Date() && this.status === "active") {
    this.status = "expired"
  }

  // Set revoked timestamp
  if (this.isRevoked && !this.revokedAt) {
    this.revokedAt = new Date()
  }

  next()
})

// Instance methods
refreshTokenSchema.methods.revoke = function (reason = "user_logout", revokedBy = null) {
  this.isRevoked = true
  this.status = "revoked"
  this.revokedAt = new Date()
  this.revokedReason = reason
  if (revokedBy) {
    this.revokedBy = revokedBy
  }
  return this.save()
}

refreshTokenSchema.methods.updateUsage = function () {
  this.lastUsedAt = new Date()
  this.usageCount += 1
  return this.save()
}

refreshTokenSchema.methods.markSuspicious = function (riskScore = 75) {
  this.securityFlags.isSuspicious = true
  this.securityFlags.riskScore = riskScore
  return this.save()
}

refreshTokenSchema.methods.updateLocation = function (locationData) {
  this.location = {
    ...this.location,
    ...locationData,
  }
  return this.save()
}

refreshTokenSchema.methods.updateDevice = function (deviceData) {
  this.device = {
    ...this.device,
    ...deviceData,
  }
  return this.save()
}

// Static methods
refreshTokenSchema.statics.findValidToken = function (token) {
  return this.findOne({
    token,
    status: "active",
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  }).populate("userId", "-password")
}

refreshTokenSchema.statics.findUserTokens = function (userId, options = {}) {
  const query = { userId }

  if (options.activeOnly) {
    query.status = "active"
    query.isRevoked = false
    query.expiresAt = { $gt: new Date() }
  }

  return this.find(query)
    .sort({ lastUsedAt: -1 })
    .limit(options.limit || 50)
}

refreshTokenSchema.statics.revokeUserTokens = function (userId, reason = "user_logout", excludeToken = null) {
  const query = {
    userId,
    status: "active",
    isRevoked: false,
  }

  if (excludeToken) {
    query.token = { $ne: excludeToken }
  }

  return this.updateMany(query, {
    $set: {
      isRevoked: true,
      status: "revoked",
      revokedAt: new Date(),
      revokedReason: reason,
    },
  })
}

refreshTokenSchema.statics.revokeTokenFamily = function (tokenFamily, reason = "security_breach") {
  return this.updateMany(
    {
      tokenFamily,
      status: "active",
      isRevoked: false,
    },
    {
      $set: {
        isRevoked: true,
        status: "revoked",
        revokedAt: new Date(),
        revokedReason: reason,
      },
    },
  )
}

refreshTokenSchema.statics.cleanupExpired = function () {
  return this.deleteMany({
    $or: [
      { expiresAt: { $lt: new Date() } },
      { status: "expired" },
      {
        isRevoked: true,
        revokedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days old
      },
    ],
  })
}

refreshTokenSchema.statics.findSuspiciousTokens = function (options = {}) {
  const query = {
    "securityFlags.isSuspicious": true,
    status: "active",
  }

  if (options.riskScoreMin) {
    query["securityFlags.riskScore"] = { $gte: options.riskScoreMin }
  }

  if (options.userId) {
    query.userId = options.userId
  }

  return this.find(query)
    .populate("userId", "firstName lastName email")
    .sort({ "securityFlags.riskScore": -1, createdAt: -1 })
}

refreshTokenSchema.statics.getTokenStats = function (userId = null) {
  const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {}

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTokens: { $sum: 1 },
        activeTokens: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "active"] },
                  { $eq: ["$isRevoked", false] },
                  { $gt: ["$expiresAt", new Date()] },
                ],
              },
              1,
              0,
            ],
          },
        },
        revokedTokens: {
          $sum: { $cond: [{ $eq: ["$isRevoked", true] }, 1, 0] },
        },
        expiredTokens: {
          $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] },
        },
        suspiciousTokens: {
          $sum: { $cond: [{ $eq: ["$securityFlags.isSuspicious", true] }, 1, 0] },
        },
        avgUsageCount: { $avg: "$usageCount" },
        avgSessionDuration: {
          $avg: {
            $divide: [
              { $subtract: ["$lastUsedAt", "$createdAt"] },
              1000, // Convert to seconds
            ],
          },
        },
      },
    },
  ])
}

refreshTokenSchema.statics.getUserSessions = function (userId) {
  return this.find({
    userId,
    status: "active",
    isRevoked: false,
    expiresAt: { $gt: new Date() },
  })
    .select("sessionId ipAddress userAgent device location lastUsedAt createdAt securityFlags")
    .sort({ lastUsedAt: -1 })
}

// Add pagination plugin
refreshTokenSchema.plugin(mongoosePaginate)

// Create and export model
const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema)

module.exports = RefreshToken
