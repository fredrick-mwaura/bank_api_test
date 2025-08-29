import Transaction from "../Models/Transaction.js"
import Account from "../Models/Account.js"
import User from "../Models/User.js"
import transactionService from "../Services/transactionService.js"
import notificationService from "../Services/notificationService.js"
import auditService from "../Services/AuditService.js"
import logger from "../utils/logger.js"
// import { generateTransactionId } from "../utils/helpers"
import {config} from "../../config/index.js"
import mongoose from "mongoose" // Declare mongoose variable

// Laravel-style transaction controller
class TransactionController {
  // Get user's transactions with filtering and pagination
  async getTransactions(req, res) {
    try {
      const userId = req.user._id
      const {
        page = 1,
        limit = 20,
        accountId,
        type,
        status,
        category,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        search,
      } = req.query

      // Build query filters
      const filters = { userId }

      if (accountId) {
        filters.$or = [{ fromAccount: accountId }, { toAccount: accountId }]
      }

      if (type) filters.type = type
      if (status) filters.status = status
      if (category) filters.category = category

      if (startDate || endDate) {
        filters.createdAt = {}
        if (startDate) filters.createdAt.$gte = new Date(startDate)
        if (endDate) filters.createdAt.$lte = new Date(endDate)
      }

      if (minAmount || maxAmount) {
        filters.amount = {}
        if (minAmount) filters.amount.$gte = Number.parseFloat(minAmount)
        if (maxAmount) filters.amount.$lte = Number.parseFloat(maxAmount)
      }

      if (search) {
        filters.$or = [
          { description: { $regex: search, $options: "i" } },
          { transactionId: { $regex: search, $options: "i" } },
        ]
      }

      // Execute query with pagination
      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: "fromAccount", select: "accountNumber accountType" },
          { path: "toAccount", select: "accountNumber accountType" },
        ],
      }

      const result = await Transaction.paginate(filters, options)

      // Calculate summary statistics
      const summary = await transactionService.getTransactionSummary(userId, filters)

      res.status(200).json({
        status: "success",
        data: {
          transactions: result.docs,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalDocs,
            itemsPerPage: result.limit,
            hasNextPage: result.hasNextPage,
            hasPrevPage: result.hasPrevPage,
          },
          summary,
        },
      })
    } catch (error) {
      logger.error("Error fetching transactions:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch transactions",
      })
    }
  }

  // Get single transaction details
  async getTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id

      const transaction = await Transaction.findById(id)
        .populate("fromAccount", "accountNumber accountType userId")
        .populate("toAccount", "accountNumber accountType userId")
        .populate("userId", "firstName lastName email")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      // Check if user has access to this transaction
      const hasAccess = await transactionService.verifyTransactionAccess(transaction, userId)
      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: "Access denied to this transaction",
        })
      }

      // Log transaction access
      await auditService.logActivity({
        userId,
        action: "transaction_viewed",
        resource: "transaction",
        resourceId: transaction._id,
        metadata: { transactionId: transaction.transactionId },
      })

      res.status(200).json({
        status: "success",
        data: { transaction },
      })
    } catch (error) {
      logger.error("Error fetching transaction:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch transaction",
      })
    }
  }

  // Verify transaction with OTP/2FA
  async verifyTransaction(req, res) {
    try {
      const { id } = req.params
      const { verificationCode, method = "sms" } = req.body
      const userId = req.user._id

      // Find the transaction
      const transaction = await Transaction.findById(id)
        .populate("fromAccount", "accountNumber accountType userId balance")
        .populate("toAccount", "accountNumber accountType")
        .populate("userId", "firstName lastName email phoneNumber")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      // Check if user has access to this transaction
      const hasAccess = await transactionService.verifyTransactionAccess(transaction, userId)
      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: "Access denied to this transaction",
        })
      }

      // Check if transaction is in pending_verification status
      if (transaction.status !== "pending_verification") {
        return res.status(400).json({
          status: "error",
          message: "Transaction is not pending verification",
        })
      }

      // Check if verification code has expired
      const verificationExpiry = transaction.verificationExpiry
      if (!verificationExpiry || new Date() > verificationExpiry) {
        // Mark transaction as expired
        transaction.status = "expired"
        transaction.failureReason = "Verification code expired"
        await transaction.save()

        return res.status(400).json({
          status: "error",
          message: "Verification code has expired. Please initiate a new transaction.",
        })
      }

      // Verify the code
      const isValidCode = await transactionService.verifyTransactionCode(transaction, verificationCode, method)

      if (!isValidCode) {
        // Increment failed verification attempts
        transaction.verificationAttempts = (transaction.verificationAttempts || 0) + 1

        // If too many failed attempts, mark as failed
        if (transaction.verificationAttempts >= 3) {
          transaction.status = "failed"
          transaction.failureReason = "Too many failed verification attempts"
          await transaction.save()

          // Log security event
          await auditService.logActivity({
            userId,
            action: "transaction_verification_failed_max_attempts",
            resource: "transaction",
            resourceId: transaction._id,
            metadata: {
              transactionId: transaction.transactionId,
              attempts: transaction.verificationAttempts,
              method,
            },
            severity: "high",
          })

          return res.status(400).json({
            status: "error",
            message: "Transaction failed due to too many incorrect verification attempts",
          })
        }

        await transaction.save()

        // Log failed verification attempt
        await auditService.logActivity({
          userId,
          action: "transaction_verification_failed",
          resource: "transaction",
          resourceId: transaction._id,
          metadata: {
            transactionId: transaction.transactionId,
            attempts: transaction.verificationAttempts,
            method,
          },
        })

        return res.status(400).json({
          status: "error",
          message: `Invalid verification code. ${3 - transaction.verificationAttempts} attempts remaining.`,
        })
      }

      // Verification successful - now execute the transaction
      const session = await mongoose.startSession()

      try {
        session.startTransaction()

        // Re-check account balance and status
        const fromAccount = await Account.findById(transaction.fromAccount._id).session(session)

        if (!fromAccount) {
          throw new Error("Source account not found")
        }

        if (fromAccount.status !== "active") {
          throw new Error("Source account is not active")
        }

        // Check if sufficient balance is still available
        if (fromAccount.balance < transaction.amount) {
          throw new Error("Insufficient funds")
        }

        // Re-check transaction limits
        const limitCheck = await transactionService.checkTransactionLimits(
          fromAccount,
          transaction.amount,
          transaction.type,
        )

        if (!limitCheck.allowed) {
          throw new Error(limitCheck.reason)
        }

        // Execute the transaction based on type
        let executionResult

        switch (transaction.type) {
          case "transfer":
          case "internal_transfer":
            const toAccount = await Account.findById(transaction.toAccount._id).session(session)
            if (!toAccount) {
              throw new Error("Destination account not found")
            }

            if (toAccount.status !== "active") {
              throw new Error("Destination account is not active")
            }

            // Update balances
            fromAccount.balance -= transaction.amount
            toAccount.balance += transaction.amount

            // Save accounts
            await fromAccount.save({ session })
            await toAccount.save({ session })

            executionResult = {
              fromAccountBalance: fromAccount.balance,
              toAccountBalance: toAccount.balance,
            }
            break

          case "external_transfer":
            // For external transfers, just deduct from source account
            fromAccount.balance -= transaction.amount
            await fromAccount.save({ session })

            executionResult = {
              fromAccountBalance: fromAccount.balance,
            }
            break

          case "withdrawal":
            fromAccount.balance -= transaction.amount
            await fromAccount.save({ session })

            executionResult = {
              fromAccountBalance: fromAccount.balance,
            }
            break

          case "bill_payment":
            fromAccount.balance -= transaction.amount
            await fromAccount.save({ session })

            executionResult = {
              fromAccountBalance: fromAccount.balance,
            }
            break

          default:
            throw new Error(`Unsupported transaction type: ${transaction.type}`)
        }

        // Update transaction status
        transaction.status = "completed"
        transaction.verifiedAt = new Date()
        transaction.verificationMethod = method
        transaction.balanceAfter = executionResult.fromAccountBalance
        transaction.processedAt = new Date()

        await transaction.save({ session })

        await session.commitTransaction()

        // Log successful verification and execution
        await auditService.logActivity({
          userId,
          action: "transaction_verified_and_executed",
          resource: "transaction",
          resourceId: transaction._id,
          metadata: {
            transactionId: transaction.transactionId,
            amount: transaction.amount,
            type: transaction.type,
            method,
            balanceAfter: executionResult.fromAccountBalance,
          },
        })

        // Send success notifications
        await notificationService.sendTransactionNotification({
          userId,
          type: "transaction_completed",
          transaction,
          account: fromAccount,
        })

        // If transfer to different user, notify recipient
        if (transaction.toAccount && transaction.toAccount.userId.toString() !== userId.toString()) {
          await notificationService.sendTransactionNotification({
            userId: transaction.toAccount.userId,
            type: "transfer_received",
            transaction,
            account: transaction.toAccount,
          })
        }

        res.status(200).json({
          status: "success",
          message: "Transaction verified and completed successfully",
          data: {
            transaction: {
              _id: transaction._id,
              transactionId: transaction.transactionId,
              type: transaction.type,
              amount: transaction.amount,
              description: transaction.description,
              status: transaction.status,
              verifiedAt: transaction.verifiedAt,
              processedAt: transaction.processedAt,
            },
            balances: executionResult,
          },
        })
      } catch (executionError) {
        await session.abortTransaction()

        // Mark transaction as failed
        transaction.status = "failed"
        transaction.failureReason = executionError.message
        transaction.failedAt = new Date()
        await transaction.save()

        // Log execution failure
        await auditService.logActivity({
          userId,
          action: "transaction_execution_failed",
          resource: "transaction",
          resourceId: transaction._id,
          metadata: {
            transactionId: transaction.transactionId,
            error: executionError.message,
          },
          severity: "high",
        })

        logger.error("Transaction execution failed after verification:", {
          transactionId: transaction.transactionId,
          error: executionError.message,
        })

        return res.status(500).json({
          status: "error",
          message: `Transaction verification successful but execution failed: ${executionError.message}`,
        })
      } finally {
        session.endSession()
      }
    } catch (error) {
      logger.error("Transaction verification error:", error)
      res.status(500).json({
        status: "error",
        message: "Transaction verification failed",
      })
    }
  }

  // Confirm transaction (for high-value transactions requiring additional confirmation)
  async confirmTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id

      const transaction = await Transaction.findById(id)
        .populate("fromAccount", "accountNumber accountType userId")
        .populate("toAccount", "accountNumber accountType")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      // Check if user has access to this transaction
      const hasAccess = await transactionService.verifyTransactionAccess(transaction, userId)
      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: "Access denied to this transaction",
        })
      }

      // Check if transaction requires confirmation
      if (transaction.status !== "pending_confirmation") {
        return res.status(400).json({
          status: "error",
          message: "Transaction does not require confirmation",
        })
      }

      // Update transaction status to pending verification
      transaction.status = "pending_verification"
      transaction.confirmedAt = new Date()

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString()
      transaction.verificationCode = verificationCode
      transaction.verificationExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
      transaction.verificationAttempts = 0

      await transaction.save()

      // Send verification code
      const user = await User.findById(userId)
      await notificationService.sendVerificationCode({
        user,
        code: verificationCode,
        transaction,
        method: "sms", // Default to SMS, could be configurable
      })

      // Log confirmation
      await auditService.logActivity({
        userId,
        action: "transaction_confirmed",
        resource: "transaction",
        resourceId: transaction._id,
        metadata: {
          transactionId: transaction.transactionId,
        },
      })

      res.status(200).json({
        status: "success",
        message: "Transaction confirmed. Verification code sent to your registered phone number.",
        data: {
          transactionId: transaction.transactionId,
          verificationExpiry: transaction.verificationExpiry,
        },
      })
    } catch (error) {
      logger.error("Transaction confirmation error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to confirm transaction",
      })
    }
  }

  // Cancel transaction
  async cancelTransaction(req, res) {
    try {
      const { id } = req.params
      const { reason } = req.body
      const userId = req.user._id

      const transaction = await Transaction.findById(id).populate("fromAccount", "accountNumber accountType userId")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      // Check if user has access to this transaction
      const hasAccess = await transactionService.verifyTransactionAccess(transaction, userId)
      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: "Access denied to this transaction",
        })
      }

      // Check if transaction can be cancelled
      const cancellableStatuses = ["pending", "pending_verification", "pending_confirmation"]
      if (!cancellableStatuses.includes(transaction.status)) {
        return res.status(400).json({
          status: "error",
          message: "Transaction cannot be cancelled in its current status",
        })
      }

      // Cancel the transaction
      transaction.status = "cancelled"
      transaction.cancelledAt = new Date()
      transaction.cancelReason = reason || "Cancelled by user"
      transaction.cancelledBy = userId

      await transaction.save()

      // Log cancellation
      await auditService.logActivity({
        userId,
        action: "transaction_cancelled",
        resource: "transaction",
        resourceId: transaction._id,
        metadata: {
          transactionId: transaction.transactionId,
          reason: reason || "Cancelled by user",
          originalStatus: cancellableStatuses.find((status) => status === transaction.status),
        },
      })

      // Send cancellation notification
      await notificationService.sendTransactionNotification({
        userId,
        type: "transaction_cancelled",
        transaction,
        account: transaction.fromAccount,
      })

      res.status(200).json({
        status: "success",
        message: "Transaction cancelled successfully",
        data: {
          transactionId: transaction.transactionId,
          cancelledAt: transaction.cancelledAt,
        },
      })
    } catch (error) {
      logger.error("Transaction cancellation error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to cancel transaction",
      })
    }
  }

  // Transfer money between accounts
  async transfer(req, res) {
    try {
      const { fromAccountId, toAccountId, amount, description, category = "other" } = req.body
      const userId = req.user._id

      // Validate accounts exist and user has access
      const fromAccount = await Account.findById(fromAccountId)
      const toAccount = await Account.findById(toAccountId)

      if (!fromAccount || !toAccount) {
        return res.status(404).json({
          status: "error",
          message: "One or both accounts not found",
        })
      }

      // Verify account ownership
      if (fromAccount.userId.toString() !== userId.toString()) {
        return res.status(403).json({
          status: "error",
          message: "You can only transfer from your own accounts",
        })
      }

      // Check account status
      if (fromAccount.status !== "active" || toAccount.status !== "active") {
        return res.status(400).json({
          status: "error",
          message: "Both accounts must be active for transfers",
        })
      }

      // Validate transfer limits
      const limitCheck = await transactionService.checkTransactionLimits(fromAccount, amount, "transfer")

      if (!limitCheck.allowed) {
        return res.status(400).json({
          status: "error",
          message: limitCheck.reason,
        })
      }

      // Check sufficient balance
      if (fromAccount.balance < amount) {
        return res.status(400).json({
          status: "error",
          message: "Insufficient funds",
        })
      }

      // Execute transfer
      const transferResult = await transactionService.executeTransfer({
        fromAccount,
        toAccount,
        amount: Number.parseFloat(amount),
        description,
        category,
        userId,
        type: "transfer",
      })

      // Send notifications
      await notificationService.sendTransactionNotification({
        userId,
        type: "transfer_sent",
        transaction: transferResult.transaction,
        account: fromAccount,
      })

      // If different user, notify recipient
      if (toAccount.userId.toString() !== userId.toString()) {
        await notificationService.sendTransactionNotification({
          userId: toAccount.userId,
          type: "transfer_received",
          transaction: transferResult.transaction,
          account: toAccount,
        })
      }

      res.status(201).json({
        status: "success",
        message: "Transfer completed successfully",
        data: {
          transaction: transferResult.transaction,
          fromAccountBalance: transferResult.fromAccountBalance,
          toAccountBalance: transferResult.toAccountBalance,
        },
      })
    } catch (error) {
      logger.error("Transfer error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Transfer failed",
      })
    }
  }

  // Internal transfer between user's own accounts
  async internalTransfer(req, res) {
    try {
      const { fromAccountId, toAccountId, amount, description } = req.body
      const userId = req.user._id

      // Validate both accounts belong to the user
      const accounts = await Account.find({
        _id: { $in: [fromAccountId, toAccountId] },
        userId,
      })

      if (accounts.length !== 2) {
        return res.status(400).json({
          status: "error",
          message: "Both accounts must belong to you for internal transfers",
        })
      }

      const fromAccount = accounts.find((acc) => acc._id.toString() === fromAccountId)
      const toAccount = accounts.find((acc) => acc._id.toString() === toAccountId)

      // Check sufficient balance
      if (fromAccount.balance < amount) {
        return res.status(400).json({
          status: "error",
          message: "Insufficient funds",
        })
      }

      // Execute internal transfer (usually instant and free)
      const transferResult = await transactionService.executeInternalTransfer({
        fromAccount,
        toAccount,
        amount: Number.parseFloat(amount),
        description: description || "Internal transfer",
        userId,
      })

      res.status(201).json({
        status: "success",
        message: "Internal transfer completed successfully",
        data: {
          transaction: transferResult.transaction,
          fromAccountBalance: transferResult.fromAccountBalance,
          toAccountBalance: transferResult.toAccountBalance,
        },
      })
    } catch (error) {
      logger.error("Internal transfer error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Internal transfer failed",
      })
    }
  }

  // External transfer to other banks
  async externalTransfer(req, res) {
    try {
      const {
        fromAccountId,
        recipientBankCode,
        recipientAccountNumber,
        recipientName,
        amount,
        description,
        transferType = "standard", // standard, express, instant
      } = req.body
      const userId = req.user._id

      const fromAccount = await Account.findOne({ _id: fromAccountId, userId })

      if (!fromAccount) {
        return res.status(404).json({
          status: "error",
          message: "Account not found",
        })
      }

      // Check external transfer limits (usually higher security)
      const limitCheck = await transactionService.checkExternalTransferLimits(fromAccount, amount, transferType)

      if (!limitCheck.allowed) {
        return res.status(400).json({
          status: "error",
          message: limitCheck.reason,
        })
      }

      // Calculate fees
      const fees = await transactionService.calculateTransferFees(amount, transferType, "external")

      const totalAmount = Number.parseFloat(amount) + fees

      if (fromAccount.balance < totalAmount) {
        return res.status(400).json({
          status: "error",
          message: `Insufficient funds. Required: $${totalAmount.toFixed(2)} (including $${fees.toFixed(2)} fee)`,
        })
      }

      // Execute external transfer
      const transferResult = await transactionService.executeExternalTransfer({
        fromAccount,
        recipientBankCode,
        recipientAccountNumber,
        recipientName,
        amount: Number.parseFloat(amount),
        fees,
        description,
        transferType,
        userId,
      })

      res.status(201).json({
        status: "success",
        message: "External transfer initiated successfully",
        data: {
          transaction: transferResult.transaction,
          estimatedArrival: transferResult.estimatedArrival,
          fees,
          totalAmount,
          fromAccountBalance: transferResult.fromAccountBalance,
        },
      })
    } catch (error) {
      logger.error("External transfer error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "External transfer failed",
      })
    }
  }


  // Get recurring transactions
  async getRecurringTransactions(req, res) {
    try {
      const userId = req.user._id
      const { page = 1, limit = 20, status = "active" } = req.query
      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { nextExecutionDate: 1 },
        populate: [
          { path: "fromAccount", select: "accountNumber accountType balance" },
          { path: "toAccount", select: "accountNumber accountType" },
          { path: "billPayment.payeeId", select: "name accountNumber" },
        ],
      }

      const result = await RecurringTransaction.paginate({ userId, status }, options)

      res.status(200).json({
        status: "success",
        data: {
          recurringTransactions: result.docs,
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
      logger.error("Error fetching recurring transactions:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch recurring transactions",
      })
    }
  }

  // Create recurring transaction
  async createRecurringTransaction(req, res) {
    try {
      const {
        fromAccountId,
        toAccountId,
        amount,
        description,
        frequency,
        startDate,
        endDate,
        transactionType,
        indefinite = false,
        category = "other",
        billPayment,
        externalRecipient,
        notifications = {
          beforeExecution: { enabled: false },
          afterExecution: { enabled: true, onSuccess: true, onFailure: true },
        },
      } = req.body
      const userId = req.user._id

      // Validate from account exists and user has access
      const fromAccount = await Account.findOne({ _id: fromAccountId, userId })
      if (!fromAccount) {
        return res.status(404).json({
          status: "error",
          message: "From account not found",
        })
      }

      if (fromAccount.status !== "active") {
        return res.status(400).json({
          status: "error",
          message: "Account must be active for recurring transactions",
        })
      }

      // Validate to account if internal transfer
      let toAccount = null
      if (toAccountId && transactionType === "transfer") {
        toAccount = await Account.findById(toAccountId)
        if (!toAccount) {
          return res.status(404).json({
            status: "error",
            message: "To account not found",
          })
        }
      }

      // Validate start date
      const startDateTime = new Date(startDate)
      if (startDateTime <= new Date()) {
        return res.status(400).json({
          status: "error",
          message: "Start date must be in the future",
        })
      }

      // Calculate next execution date
      const nextExecutionDate = transactionService.calculateNextExecutionDate(startDateTime, frequency)
      // Create recurring transaction
      const recurringTransaction = new RecurringTransaction({
        userId,
        transactionType,
        amount: Number.parseFloat(amount),
        description,
        category,
        frequency,
        startDate: startDateTime,
        endDate: endDate ? new Date(endDate) : null,
        nextExecutionDate,
        fromAccount: fromAccountId,
        toAccount: toAccountId,
        indefinite,
        billPayment,
        externalRecipient,
        notifications,
        createdBy: userId,
      })

      await recurringTransaction.save()

      // Log the creation
      await auditService.logActivity({
        userId,
        action: "recurring_transaction_created",
        resource: "recurring_transaction",
        resourceId: recurringTransaction._id,
        metadata: {
          transactionType,
          amount,
          frequency,
          startDate: startDateTime,
        },
      })

      res.status(201).json({
        status: "success",
        message: "Recurring transaction created successfully",
        data: { recurringTransaction },
      })
    } catch (error) {
      logger.error("Create recurring transaction error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Failed to create recurring transaction",
      })
    }
  }

  // Update recurring transaction
  async updateRecurringTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id
      const updates = req.body
      const recurringTransaction = await RecurringTransaction.findOne({
        _id: id,
        userId,
      })

      if (!recurringTransaction) {
        return res.status(404).json({
          status: "error",
          message: "Recurring transaction not found",
        })
      }

      // Don't allow updates to completed or cancelled transactions
      if (["completed", "cancelled"].includes(recurringTransaction.status)) {
        return res.status(400).json({
          status: "error",
          message: "Cannot update completed or cancelled recurring transactions",
        })
      }

      // Store original values for audit
      const originalValues = {
        amount: recurringTransaction.amount,
        frequency: recurringTransaction.frequency,
        status: recurringTransaction.status,
      }

      // Update allowed fields
      const allowedUpdates = ["amount", "description", "frequency", "endDate", "status", "indefinite", "notifications"]

      allowedUpdates.forEach((field) => {
        if (updates[field] !== undefined) {
          recurringTransaction[field] = updates[field]
        }
      })

      // Recalculate next execution date if frequency changed
      if (updates.frequency && updates.frequency !== originalValues.frequency) {
        recurringTransaction.nextExecutionDate = transactionService.calculateNextExecutionDate(
          recurringTransaction.lastExecutionDate || recurringTransaction.startDate,
          updates.frequency,
        )
      }

      recurringTransaction.updatedBy = userId
      await recurringTransaction.save()

      // Log the update
      await auditService.logActivity({
        userId,
        action: "recurring_transaction_updated",
        resource: "recurring_transaction",
        resourceId: recurringTransaction._id,
        metadata: {
          originalValues,
          newValues: updates,
        },
      })

      res.status(200).json({
        status: "success",
        message: "Recurring transaction updated successfully",
        data: { recurringTransaction },
      })
    } catch (error) {
      logger.error("Update recurring transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to update recurring transaction",
      })
    }
  }

  // Cancel recurring transaction
  async cancelRecurringTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id
      const { reason } = req.body


      const recurringTransaction = await RecurringTransaction.findOne({
        _id: id,
        userId,
      })

      if (!recurringTransaction) {
        return res.status(404).json({
          status: "error",
          message: "Recurring transaction not found",
        })
      }

      if (recurringTransaction.status === "cancelled") {
        return res.status(400).json({
          status: "error",
          message: "Recurring transaction is already cancelled",
        })
      }

      recurringTransaction.status = "cancelled"
      recurringTransaction.cancelledAt = new Date()
      recurringTransaction.cancelReason = reason || "Cancelled by user"
      recurringTransaction.updatedBy = userId

      await recurringTransaction.save()

      // Log the cancellation
      await auditService.logActivity({
        userId,
        action: "recurring_transaction_cancelled",
        resource: "recurring_transaction",
        resourceId: recurringTransaction._id,
        metadata: {
          reason: reason || "Cancelled by user",
          executionCount: recurringTransaction.executionCount,
          totalAmount: recurringTransaction.amount * recurringTransaction.executionCount,
        },
      })

      res.status(200).json({
        status: "success",
        message: "Recurring transaction cancelled successfully",
      })
    } catch (error) {
      logger.error("Cancel recurring transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to cancel recurring transaction",
      })
    }
  }

  // Pause recurring transaction
  async pauseRecurringTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id
      const { reason } = req.body

      const recurringTransaction = await RecurringTransaction.findOne({
        _id: id,
        userId,
      })

      if (!recurringTransaction) {
        return res.status(404).json({
          status: "error",
          message: "Recurring transaction not found",
        })
      }

      if (recurringTransaction.status !== "active") {
        return res.status(400).json({
          status: "error",
          message: "Can only pause active recurring transactions",
        })
      }

      recurringTransaction.status = "paused"
      recurringTransaction.pausedAt = new Date()
      recurringTransaction.pauseReason = reason || "Paused by user"
      recurringTransaction.updatedBy = userId

      await recurringTransaction.save()

      // Log the pause
      await auditService.logActivity({
        userId,
        action: "recurring_transaction_paused",
        resource: "recurring_transaction",
        resourceId: recurringTransaction._id,
        metadata: {
          reason: reason || "Paused by user",
        },
      })

      res.status(200).json({
        status: "success",
        message: "Recurring transaction paused successfully",
      })
    } catch (error) {
      logger.error("Pause recurring transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to pause recurring transaction",
      })
    }
  }

  // Resume recurring transaction
  async resumeRecurringTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id


      const recurringTransaction = await RecurringTransaction.findOne({
        _id: id,
        userId,
      })

      if (!recurringTransaction) {
        return res.status(404).json({
          status: "error",
          message: "Recurring transaction not found",
        })
      }

      if (recurringTransaction.status !== "paused") {
        return res.status(400).json({
          status: "error",
          message: "Can only resume paused recurring transactions",
        })
      }

      recurringTransaction.status = "active"
      recurringTransaction.resumedAt = new Date()
      recurringTransaction.pauseReason = null
      recurringTransaction.pausedAt = null

      // Recalculate next execution date
      recurringTransaction.nextExecutionDate = transactionService.calculateNextExecutionDate(
        recurringTransaction.lastExecutionDate || recurringTransaction.startDate,
        recurringTransaction.frequency,
      )

      recurringTransaction.updatedBy = userId
      await recurringTransaction.save()

      // Log the resume
      await auditService.logActivity({
        userId,
        action: "recurring_transaction_resumed",
        resource: "recurring_transaction",
        resourceId: recurringTransaction._id,
        metadata: {
          nextExecutionDate: recurringTransaction.nextExecutionDate,
        },
      })

      res.status(200).json({
        status: "success",
        message: "Recurring transaction resumed successfully",
        data: {
          nextExecutionDate: recurringTransaction.nextExecutionDate,
        },
      })
    } catch (error) {
      logger.error("Resume recurring transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to resume recurring transaction",
      })
    }
  }

  // Get recurring transaction execution history
  async getRecurringTransactionHistory(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id
      const { page = 1, limit = 20 } = req.query


      const recurringTransaction = await RecurringTransaction.findOne({
        _id: id,
        userId,
      })

      if (!recurringTransaction) {
        return res.status(404).json({
          status: "error",
          message: "Recurring transaction not found",
        })
      }

      // Get execution history with pagination
      const skip = (Number.parseInt(page) - 1) * Number.parseInt(limit)
      const executionHistory = recurringTransaction.executionHistory
        .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt))
        .slice(skip, skip + Number.parseInt(limit))

      const totalExecutions = recurringTransaction.executionHistory.length
      const totalPages = Math.ceil(totalExecutions / Number.parseInt(limit))

      // Get related transactions
      const transactionIds = executionHistory.filter((exec) => exec.transactionId).map((exec) => exec.transactionId)

      const transactions = await Transaction.find({
        _id: { $in: transactionIds },
      }).populate("fromAccount toAccount", "accountNumber accountType")

      res.status(200).json({
        status: "success",
        data: {
          recurringTransaction: {
            _id: recurringTransaction._id,
            description: recurringTransaction.description,
            amount: recurringTransaction.amount,
            frequency: recurringTransaction.frequency,
            status: recurringTransaction.status,
            executionCount: recurringTransaction.executionCount,
            totalAmount: recurringTransaction.amount * recurringTransaction.executionCount,
          },
          executionHistory,
          transactions,
          pagination: {
            currentPage: Number.parseInt(page),
            totalPages,
            totalItems: totalExecutions,
            itemsPerPage: Number.parseInt(limit),
            hasNextPage: Number.parseInt(page) < totalPages,
            hasPrevPage: Number.parseInt(page) > 1,
          },
        },
      })
    } catch (error) {
      logger.error("Get recurring transaction history error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get recurring transaction history",
      })
    }
  }


  // Get transaction analytics
  async getTransactionSummary(req, res) {
    try {
      const userId = req.user._id
      const { period = "30d", accountId } = req.query

      const summary = await transactionService.getTransactionAnalytics(userId, period, accountId)

      res.status(200).json({
        status: "success",
        data: { summary },
      })
    } catch (error) {
      logger.error("Transaction summary error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get transaction summary",
      })
    }
  }

  // Get spending analytics
  async getSpendingAnalytics(req, res) {
    try {
      const userId = req.user._id
      const { period = "30d", groupBy = "category" } = req.query

      const analytics = await transactionService.getSpendingAnalytics(userId, period, groupBy)

      res.status(200).json({
        status: "success",
        data: { analytics },
      })
    } catch (error) {
      logger.error("Spending analytics error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get spending analytics",
      })
    }
  }

  // Get category analytics
  async getCategoryAnalytics(req, res) {
    try {
      const userId = req.user._id
      const { period = "30d" } = req.query

      const categoryData = await transactionService.getCategoryAnalytics(userId, period)

      res.status(200).json({
        status: "success",
        data: { categoryData },
      })
    } catch (error) {
      logger.error("Category analytics error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get category analytics",
      })
    }
  }

  // Admin: Get all transactions
  async getAllTransactions(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        status,
        type,
        flagged,
        suspicious,
        startDate,
        endDate,
        minAmount,
        maxAmount,
      } = req.query

      const filters = {}

      if (status) filters.status = status
      if (type) filters.type = type
      if (flagged === "true") filters.flagged = true
      if (suspicious === "true") filters.suspicious = true

      if (startDate || endDate) {
        filters.createdAt = {}
        if (startDate) filters.createdAt.$gte = new Date(startDate)
        if (endDate) filters.createdAt.$lte = new Date(endDate)
      }

      if (minAmount || maxAmount) {
        filters.amount = {}
        if (minAmount) filters.amount.$gte = Number.parseFloat(minAmount)
        if (maxAmount) filters.amount.$lte = Number.parseFloat(maxAmount)
      }

      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: "fromAccount", select: "accountNumber accountType userId" },
          { path: "toAccount", select: "accountNumber accountType userId" },
          { path: "userId", select: "firstName lastName email" },
        ],
      }

      const result = await Transaction.paginate(filters, options)

      res.status(200).json({
        status: "success",
        data: {
          transactions: result.docs,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalDocs,
            itemsPerPage: result.limit,
          },
        },
      })
    } catch (error) {
      logger.error("Admin get all transactions error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch transactions",
      })
    }
  }

  // Admin: Get transaction statistics
  async getTransactionStats(req, res) {
    try {
      const stats = await transactionService.getAdminTransactionStats()

      res.status(200).json({
        status: "success",
        data: { stats },
      })
    } catch (error) {
      logger.error("Transaction stats error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get transaction statistics",
      })
    }
  }

  // Deposit money to account
  async deposit(req, res) {
    try {
      const { accountId, amount, description, depositType = "cash" } = req.body
      const userId = req.user._id

      const account = await Account.findOne({ _id: accountId, userId })

      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found",
        })
      }

      if (account.status !== "active") {
        return res.status(400).json({
          status: "error",
          message: "Account must be active for deposits",
        })
      }

      // Execute deposit
      const depositResult = await transactionService.executeDeposit({
        account,
        amount: Number.parseFloat(amount),
        description: description || `${depositType} deposit`,
        depositType,
        userId,
      })

      // Send notification
      await notificationService.sendTransactionNotification({
        userId,
        type: "deposit_received",
        transaction: depositResult.transaction,
        account,
      })

      res.status(201).json({
        status: "success",
        message: "Deposit completed successfully",
        data: {
          transaction: depositResult.transaction,
          accountBalance: depositResult.accountBalance,
        },
      })
    } catch (error) {
      logger.error("Deposit error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Deposit failed",
      })
    }
  }

  // Check deposit (mobile check deposit)
  async depositCheck(req, res) {
    try {
      const { accountId, amount, checkNumber, description } = req.body
      const userId = req.user._id

      const account = await Account.findOne({ _id: accountId, userId })

      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found",
        })
      }

      // Check deposit limits
      const limitCheck = await transactionService.checkCheckDepositLimits(account, amount)

      if (!limitCheck.allowed) {
        return res.status(400).json({
          status: "error",
          message: limitCheck.reason,
        })
      }

      // Execute check deposit (usually pending for verification)
      const depositResult = await transactionService.executeCheckDeposit({
        account,
        amount: Number.parseFloat(amount),
        checkNumber,
        description: description || "Mobile check deposit",
        userId,
      })

      res.status(201).json({
        status: "success",
        message: "Check deposit submitted for processing",
        data: {
          transaction: depositResult.transaction,
          processingTime: "1-2 business days",
          availabilityDate: depositResult.availabilityDate,
        },
      })
    } catch (error) {
      logger.error("Check deposit error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Check deposit failed",
      })
    }
  }

  // Withdraw money from account
  async withdrawal(req, res) {
    try {
      const { accountId, amount, description, withdrawalType = "branch" } = req.body
      const userId = req.user._id

      const account = await Account.findOne({ _id: accountId, userId })

      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found",
        })
      }

      // Check withdrawal limits
      const limitCheck = await transactionService.checkWithdrawalLimits(account, amount, withdrawalType)

      if (!limitCheck.allowed) {
        return res.status(400).json({
          status: "error",
          message: limitCheck.reason,
        })
      }

      // Check sufficient balance
      if (account.balance < amount) {
        return res.status(400).json({
          status: "error",
          message: "Insufficient funds",
        })
      }

      // Execute withdrawal
      const withdrawalResult = await transactionService.executeWithdrawal({
        account,
        amount: Number.parseFloat(amount),
        description: description || `${withdrawalType} withdrawal`,
        withdrawalType,
        userId,
      })

      // Send notification
      await notificationService.sendTransactionNotification({
        userId,
        type: "withdrawal_completed",
        transaction: withdrawalResult.transaction,
        account,
      })

      res.status(201).json({
        status: "success",
        message: "Withdrawal completed successfully",
        data: {
          transaction: withdrawalResult.transaction,
          accountBalance: withdrawalResult.accountBalance,
        },
      })
    } catch (error) {
      logger.error("Withdrawal error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Withdrawal failed",
      })
    }
  }

  // ATM withdrawal
  async atmWithdrawal(req, res) {
    try {
      const { accountId, amount, atmId, location } = req.body
      const userId = req.user._id

      const account = await Account.findOne({ _id: accountId, userId })

      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found",
        })
      }

      // Check ATM withdrawal limits (usually lower than branch)
      const limitCheck = await transactionService.checkATMWithdrawalLimits(account, amount)

      if (!limitCheck.allowed) {
        return res.status(400).json({
          status: "error",
          message: limitCheck.reason,
        })
      }

      // Execute ATM withdrawal
      const withdrawalResult = await transactionService.executeATMWithdrawal({
        account,
        amount: Number.parseFloat(amount),
        atmId,
        location,
        userId,
      })

      res.status(201).json({
        status: "success",
        message: "ATM withdrawal completed successfully",
        data: {
          transaction: withdrawalResult.transaction,
          accountBalance: withdrawalResult.accountBalance,
          atmFee: withdrawalResult.atmFee,
        },
      })
    } catch (error) {
      logger.error("ATM withdrawal error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "ATM withdrawal failed",
      })
    }
  }

  // Make payment to merchant/service
  async makePayment(req, res) {
    try {
      const {
        accountId,
        merchantId,
        merchantName,
        amount,
        description,
        category = "payment",
        paymentMethod = "account_transfer",
      } = req.body
      const userId = req.user._id

      const account = await Account.findOne({ _id: accountId, userId })

      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found",
        })
      }

      // Check payment limits
      const limitCheck = await transactionService.checkPaymentLimits(account, amount)

      if (!limitCheck.allowed) {
        return res.status(400).json({
          status: "error",
          message: limitCheck.reason,
        })
      }

      // Execute payment
      const paymentResult = await transactionService.executePayment({
        account,
        merchantId,
        merchantName,
        amount: Number.parseFloat(amount),
        description,
        category,
        paymentMethod,
        userId,
      })

      res.status(201).json({
        status: "success",
        message: "Payment completed successfully",
        data: {
          transaction: paymentResult.transaction,
          accountBalance: paymentResult.accountBalance,
          paymentReference: paymentResult.paymentReference,
        },
      })
    } catch (error) {
      logger.error("Payment error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Payment failed",
      })
    }
  }

  // Pay bills
  async payBill(req, res) {
    try {
      const { accountId, billerCode, billerName, customerNumber, amount, description } = req.body
      const userId = req.user._id

      const account = await Account.findOne({ _id: accountId, userId })

      if (!account) {
        return res.status(404).json({
          status: "error",
          message: "Account not found",
        })
      }

      // Execute bill payment
      const paymentResult = await transactionService.executeBillPayment({
        account,
        billerCode,
        billerName,
        customerNumber,
        amount: Number.parseFloat(amount),
        description: description || `Bill payment to ${billerName}`,
        userId,
      })

      res.status(201).json({
        status: "success",
        message: "Bill payment completed successfully",
        data: {
          transaction: paymentResult.transaction,
          accountBalance: paymentResult.accountBalance,
          confirmationNumber: paymentResult.confirmationNumber,
        },
      })
    } catch (error) {
      logger.error("Bill payment error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Bill payment failed",
      })
    }
  }

  // Get scheduled transactions
  async getScheduledTransactions(req, res) {
    try {
      const userId = req.user._id
      const { page = 1, limit = 20, status = "active" } = req.query

      const ScheduledTransaction = require("../models/ScheduledTransaction")

      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { nextExecutionDate: 1 },
        populate: [
          { path: "fromAccount", select: "accountNumber accountType" },
          { path: "toAccount", select: "accountNumber accountType" },
        ],
      }

      const result = await ScheduledTransaction.paginate({ userId, status }, options)

      res.status(200).json({
        status: "success",
        data: {
          scheduledTransactions: result.docs,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalDocs,
            itemsPerPage: result.limit,
          },
        },
      })
    } catch (error) {
      logger.error("Error fetching scheduled transactions:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch scheduled transactions",
      })
    }
  }

  // Schedule a transaction
  async scheduleTransaction(req, res) {
    try {
      const {
        fromAccountId,
        toAccountId,
        amount,
        description,
        executionDate,
        frequency = "once", // once, daily, weekly, monthly, yearly
      } = req.body
      const userId = req.user._id

      // Validate execution date
      const execDate = new Date(executionDate)
      if (execDate <= new Date()) {
        return res.status(400).json({
          status: "error",
          message: "Execution date must be in the future",
        })
      }

      const scheduledTransaction = await transactionService.scheduleTransaction({
        userId,
        fromAccountId,
        toAccountId,
        amount: Number.parseFloat(amount),
        description,
        executionDate: execDate,
        frequency,
      })

      res.status(201).json({
        status: "success",
        message: "Transaction scheduled successfully",
        data: { scheduledTransaction },
      })
    } catch (error) {
      logger.error("Schedule transaction error:", error)
      res.status(500).json({
        status: "error",
        message: error.message || "Failed to schedule transaction",
      })
    }
  }

  // Update scheduled transaction
  async updateScheduledTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id
      const updates = req.body

      const ScheduledTransaction = require("../models/ScheduledTransaction")

      const scheduledTransaction = await ScheduledTransaction.findOne({
        _id: id,
        userId,
      })

      if (!scheduledTransaction) {
        return res.status(404).json({
          status: "error",
          message: "Scheduled transaction not found",
        })
      }

      // Update the scheduled transaction
      Object.assign(scheduledTransaction, updates)
      await scheduledTransaction.save()

      res.status(200).json({
        status: "success",
        message: "Scheduled transaction updated successfully",
        data: { scheduledTransaction },
      })
    } catch (error) {
      logger.error("Update scheduled transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to update scheduled transaction",
      })
    }
  }

  // Cancel scheduled transaction
  async cancelScheduledTransaction(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id

      const ScheduledTransaction = require("../models/ScheduledTransaction")

      const scheduledTransaction = await ScheduledTransaction.findOne({
        _id: id,
        userId,
      })

      if (!scheduledTransaction) {
        return res.status(404).json({
          status: "error",
          message: "Scheduled transaction not found",
        })
      }

      scheduledTransaction.status = "cancelled"
      await scheduledTransaction.save()

      res.status(200).json({
        status: "success",
        message: "Scheduled transaction cancelled successfully",
      })
    } catch (error) {
      logger.error("Cancel scheduled transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to cancel scheduled transaction",
      })
    }
  }

  // Get transaction receipt
  async getTransactionReceipt(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id

      const transaction = await Transaction.findById(id)
        .populate("fromAccount", "accountNumber accountType bankName")
        .populate("toAccount", "accountNumber accountType bankName")
        .populate("userId", "firstName lastName email")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      // Check if user has access to this transaction
      const hasAccess = await transactionService.verifyTransactionAccess(transaction, userId)
      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: "Access denied to this transaction",
        })
      }

      // Generate receipt data
      const receipt = {
        transactionId: transaction.transactionId,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency || "USD",
        description: transaction.description,
        status: transaction.status,
        createdAt: transaction.createdAt,
        processedAt: transaction.processedAt,
        fromAccount: transaction.fromAccount,
        toAccount: transaction.toAccount,
        fees: transaction.fees || 0,
        reference: transaction.reference,
        balanceAfter: transaction.balanceAfter,
      }

      res.status(200).json({
        status: "success",
        data: { receipt },
      })
    } catch (error) {
      logger.error("Get transaction receipt error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get transaction receipt",
      })
    }
  }

  // Download transaction receipt as PDF
  async downloadTransactionReceipt(req, res) {
    try {
      const { id } = req.params
      const userId = req.user._id

      const transaction = await Transaction.findById(id)
        .populate("fromAccount", "accountNumber accountType bankName")
        .populate("toAccount", "accountNumber accountType bankName")
        .populate("userId", "firstName lastName email")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      // Check if user has access to this transaction
      const hasAccess = await transactionService.verifyTransactionAccess(transaction, userId)
      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: "Access denied to this transaction",
        })
      }

      // Generate PDF receipt
      const pdfBuffer = await transactionService.generateReceiptPDF(transaction)

      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", `attachment; filename="receipt-${transaction.transactionId}.pdf"`)
      res.send(pdfBuffer)
    } catch (error) {
      logger.error("Download transaction receipt error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to download transaction receipt",
      })
    }
  }

  // Dispute a transaction
  async disputeTransaction(req, res) {
    try {
      const { id } = req.params
      const { reason, description, category = "unauthorized" } = req.body
      const userId = req.user._id

      const transaction = await Transaction.findById(id).populate("fromAccount", "accountNumber accountType userId")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      // Check if user has access to this transaction
      const hasAccess = await transactionService.verifyTransactionAccess(transaction, userId)
      if (!hasAccess) {
        return res.status(403).json({
          status: "error",
          message: "Access denied to this transaction",
        })
      }

      // Check if transaction can be disputed
      const disputeEligible = await transactionService.checkDisputeEligibility(transaction)
      if (!disputeEligible.eligible) {
        return res.status(400).json({
          status: "error",
          message: disputeEligible.reason,
        })
      }

      // Create dispute
      const dispute = await transactionService.createDispute({
        transaction,
        userId,
        reason,
        description,
        category,
      })

      // Update transaction status
      transaction.status = "disputed"
      transaction.disputedAt = new Date()
      await transaction.save()

      // Log dispute creation
      await auditService.logActivity({
        userId,
        action: "transaction_disputed",
        resource: "transaction",
        resourceId: transaction._id,
        metadata: {
          transactionId: transaction.transactionId,
          disputeId: dispute._id,
          reason,
          category,
        },
      })

      res.status(201).json({
        status: "success",
        message: "Transaction dispute submitted successfully",
        data: { dispute },
      })
    } catch (error) {
      logger.error("Dispute transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to dispute transaction",
      })
    }
  }

  // Get user's disputes
  async getDisputes(req, res) {
    try {
      const userId = req.user._id
      const { page = 1, limit = 20, status } = req.query

      const Dispute = require("../models/Dispute")

      const filters = { userId }
      if (status) filters.status = status

      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { createdAt: -1 },
        populate: [{ path: "transactionId", select: "transactionId amount type description createdAt" }],
      }

      const result = await Dispute.paginate(filters, options)

      res.status(200).json({
        status: "success",
        data: {
          disputes: result.docs,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalDocs,
            itemsPerPage: result.limit,
          },
        },
      })
    } catch (error) {
      logger.error("Get disputes error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get disputes",
      })
    }
  }

  // Admin: Update transaction status
  async updateTransactionStatusAdmin(req, res) {
    try {
      const { id } = req.params
      const { status, reason } = req.body
      const adminId = req.user._id

      const transaction = await Transaction.findById(id)
        .populate("fromAccount", "accountNumber accountType")
        .populate("toAccount", "accountNumber accountType")
        .populate("userId", "firstName lastName email")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      const oldStatus = transaction.status
      transaction.status = status
      transaction.adminUpdatedBy = adminId
      transaction.adminUpdateReason = reason
      transaction.adminUpdatedAt = new Date()

      await transaction.save()

      // Log admin action
      await auditService.logActivity({
        userId: adminId,
        action: "admin_transaction_status_updated",
        resource: "transaction",
        resourceId: transaction._id,
        metadata: {
          transactionId: transaction.transactionId,
          oldStatus,
          newStatus: status,
          reason,
          targetUserId: transaction.userId._id,
        },
      })

      res.status(200).json({
        status: "success",
        message: "Transaction status updated successfully",
        data: { transaction },
      })
    } catch (error) {
      logger.error("Admin update transaction status error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to update transaction status",
      })
    }
  }

  // Admin: Get suspicious transactions
  async getSuspiciousTransactions(req, res) {
    try {
      const { page = 1, limit = 50 } = req.query

      const filters = {
        $or: [
          { suspicious: true },
          { flagged: true },
          { amount: { $gte: 10000 } }, // High value transactions
          { status: "failed" },
        ],
      }

      const options = {
        page: Number.parseInt(page),
        limit: Number.parseInt(limit),
        sort: { createdAt: -1 },
        populate: [
          { path: "fromAccount", select: "accountNumber accountType userId" },
          { path: "toAccount", select: "accountNumber accountType userId" },
          { path: "userId", select: "firstName lastName email" },
        ],
      }

      const result = await Transaction.paginate(filters, options)

      res.status(200).json({
        status: "success",
        data: {
          transactions: result.docs,
          pagination: {
            currentPage: result.page,
            totalPages: result.totalPages,
            totalItems: result.totalDocs,
            itemsPerPage: result.limit,
          },
        },
      })
    } catch (error) {
      logger.error("Get suspicious transactions error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get suspicious transactions",
      })
    }
  }

  // Admin: Flag transaction
  async flagTransaction(req, res) {
    try {
      const { id } = req.params
      const { reason, severity = "medium" } = req.body
      const adminId = req.user._id

      const transaction = await Transaction.findById(id).populate("userId", "firstName lastName email")

      if (!transaction) {
        return res.status(404).json({
          status: "error",
          message: "Transaction not found",
        })
      }

      transaction.flagged = true
      transaction.flagReason = reason
      transaction.flagSeverity = severity
      transaction.flaggedBy = adminId
      transaction.flaggedAt = new Date()

      await transaction.save()

      // Log admin action
      await auditService.logActivity({
        userId: adminId,
        action: "admin_transaction_flagged",
        resource: "transaction",
        resourceId: transaction._id,
        metadata: {
          transactionId: transaction.transactionId,
          reason,
          severity,
          targetUserId: transaction.userId._id,
        },
        severity: "high",
      })

      res.status(200).json({
        status: "success",
        message: "Transaction flagged successfully",
      })
    } catch (error) {
      logger.error("Flag transaction error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to flag transaction",
      })
    }
  }
}

const transactionController = new TransactionController()
export default transactionController