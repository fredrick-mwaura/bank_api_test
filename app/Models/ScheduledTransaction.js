import mongoose from "mongoose"

const scheduledTransactionSchema = new mongoose.Schema(
  {
    // Basic Information
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },

    // Transaction Details
    type: {
      type: String,
      enum: ["transfer", "payment", "bill_payment", "loan_payment", "investment", "savings"],
      required: true,
    },
    category: {
      type: String,
      enum: ["utilities", "rent", "mortgage", "insurance", "subscription", "loan", "investment", "savings", "other"],
      default: "other",
    },

    // Amount and Currency
    amount: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "Amount must be a positive number",
      },
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },

    // Recipient Information
    recipientType: {
      type: String,
      enum: ["internal", "external", "bill_payee"],
      required: true,
    },
    recipientAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: function () {
        return this.recipientType === "internal"
      },
    },
    recipientDetails: {
      name: {
        type: String,
        required: function () {
          return this.recipientType === "external" || this.recipientType === "bill_payee"
        },
      },
      accountNumber: {
        type: String,
        required: function () {
          return this.recipientType === "external"
        },
      },
      routingNumber: {
        type: String,
        required: function () {
          return this.recipientType === "external"
        },
      },
      bankName: String,
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
    },

    // Scheduling Information
    frequency: {
      type: String,
      enum: ["once", "daily", "weekly", "bi_weekly", "monthly", "quarterly", "semi_annually", "annually"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
      validate: {
        validator: (value) => value >= new Date(),
        message: "Start date cannot be in the past",
      },
    },
    endDate: {
      type: Date,
      validate: {
        validator: function (value) {
          return !value || value > this.startDate
        },
        message: "End date must be after start date",
      },
    },
    nextExecutionDate: {
      type: Date,
      required: true,
      index: true,
    },

    // Execution Settings
    maxExecutions: {
      type: Number,
      min: 1,
      validate: {
        validator: (value) => !value || Number.isInteger(value),
        message: "Max executions must be an integer",
      },
    },
    executionCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Status and Control
    status: {
      type: String,
      enum: ["active", "paused", "completed", "cancelled", "failed"],
      default: "active",
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // Transaction Metadata
    description: {
      type: String,
      maxlength: 500,
    },
    reference: {
      type: String,
      maxlength: 100,
    },
    memo: {
      type: String,
      maxlength: 200,
    },
    tags: [
      {
        type: String,
        maxlength: 50,
      },
    ],

    // Execution History
    lastExecutedAt: Date,
    lastExecutionResult: {
      success: Boolean,
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Transaction",
      },
      error: String,
      executedAt: Date,
    },

    // Failure Handling
    failureCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 10,
    },
    retryInterval: {
      type: Number, // in minutes
      default: 60,
      min: 1,
    },

    // Notifications
    notificationSettings: {
      beforeExecution: {
        enabled: {
          type: Boolean,
          default: false,
        },
        daysBefore: {
          type: Number,
          default: 1,
          min: 0,
          max: 30,
        },
      },
      afterExecution: {
        enabled: {
          type: Boolean,
          default: true,
        },
      },
      onFailure: {
        enabled: {
          type: Boolean,
          default: true,
        },
      },
    },

    // Security and Compliance
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,

    // Audit Trail
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Additional Metadata
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
)

// Virtual for days until next execution
scheduledTransactionSchema.virtual("daysUntilExecution").get(function () {
  if (!this.nextExecutionDate) return null
  const now = new Date()
  const diffTime = this.nextExecutionDate - now
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
})

// Virtual for remaining executions
scheduledTransactionSchema.virtual("remainingExecutions").get(function () {
  if (!this.maxExecutions) return null
  return Math.max(0, this.maxExecutions - this.executionCount)
})

// Virtual for total amount scheduled
scheduledTransactionSchema.virtual("totalAmountScheduled").get(function () {
  if (!this.maxExecutions) return null
  return this.amount * this.maxExecutions
})

// Virtual for amount executed
scheduledTransactionSchema.virtual("amountExecuted").get(function () {
  return this.amount * this.executionCount
})

// Pre-save middleware
scheduledTransactionSchema.pre("save", function (next) {
  // Set next execution date if not set
  if (!this.nextExecutionDate && this.startDate) {
    this.nextExecutionDate = this.startDate
  }

  // Update status based on conditions
  if (this.maxExecutions && this.executionCount >= this.maxExecutions) {
    this.status = "completed"
    this.isActive = false
  }

  if (this.endDate && new Date() > this.endDate) {
    this.status = "completed"
    this.isActive = false
  }

  // Validate recipient details based on type
  if (this.recipientType === "external") {
    if (!this.recipientDetails.name || !this.recipientDetails.accountNumber || !this.recipientDetails.routingNumber) {
      return next(new Error("External recipient requires name, account number, and routing number"))
    }
  }

  next()
})

// Instance methods
scheduledTransactionSchema.methods.calculateNextExecutionDate = function () {
  if (!this.nextExecutionDate) return null

  const current = new Date(this.nextExecutionDate)
  const next = new Date(current)

  switch (this.frequency) {
    case "daily":
      next.setDate(current.getDate() + 1)
      break
    case "weekly":
      next.setDate(current.getDate() + 7)
      break
    case "bi_weekly":
      next.setDate(current.getDate() + 14)
      break
    case "monthly":
      next.setMonth(current.getMonth() + 1)
      break
    case "quarterly":
      next.setMonth(current.getMonth() + 3)
      break
    case "semi_annually":
      next.setMonth(current.getMonth() + 6)
      break
    case "annually":
      next.setFullYear(current.getFullYear() + 1)
      break
    default:
      return null // For 'once' frequency
  }

  return next
}

scheduledTransactionSchema.methods.updateNextExecution = function () {
  if (this.frequency === "once") {
    this.status = "completed"
    this.isActive = false
    this.nextExecutionDate = null
  } else {
    const nextDate = this.calculateNextExecutionDate()
    if (nextDate && (!this.endDate || nextDate <= this.endDate)) {
      this.nextExecutionDate = nextDate
    } else {
      this.status = "completed"
      this.isActive = false
      this.nextExecutionDate = null
    }
  }
}

scheduledTransactionSchema.methods.recordExecution = function (success, transactionId = null, error = null) {
  this.executionCount += 1
  this.lastExecutedAt = new Date()
  this.lastExecutionResult = {
    success,
    transactionId,
    error,
    executedAt: new Date(),
  }

  if (success) {
    this.failureCount = 0 // Reset failure count on success
    this.updateNextExecution()
  } else {
    this.failureCount += 1
    if (this.failureCount >= this.maxRetries) {
      this.status = "failed"
      this.isActive = false
    }
  }
}

scheduledTransactionSchema.methods.pause = function () {
  this.status = "paused"
  this.isActive = false
}

scheduledTransactionSchema.methods.resume = function () {
  if (this.status === "paused") {
    this.status = "active"
    this.isActive = true
  }
}

scheduledTransactionSchema.methods.cancel = function () {
  this.status = "cancelled"
  this.isActive = false
}

// Static methods
scheduledTransactionSchema.statics.findDueForExecution = function (date = new Date()) {
  return this.find({
    nextExecutionDate: { $lte: date },
    status: "active",
    isActive: true,
  }).populate("userId accountId")
}

scheduledTransactionSchema.statics.findByUser = function (userId, options = {}) {
  const query = { userId }

  if (options.status) {
    query.status = options.status
  }

  if (options.isActive !== undefined) {
    query.isActive = options.isActive
  }

  return this.find(query).populate("accountId", "accountNumber accountType balance").sort({ nextExecutionDate: 1 })
}

scheduledTransactionSchema.statics.findByAccount = function (accountId, options = {}) {
  const query = { accountId }

  if (options.status) {
    query.status = options.status
  }

  return this.find(query).populate("userId", "firstName lastName email").sort({ nextExecutionDate: 1 })
}

// Export the model
const ScheduledTransaction = mongoose.model("ScheduledTransaction", scheduledTransactionSchema)

export default ScheduledTransaction
