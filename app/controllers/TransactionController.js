// import Transaction from "../Models/Transaction.js"
// import Account from "../Models/Account.js"
// import User from "../Models/User.js"
// import transactionService from "../Services/transactionService.js"
// import notificationService from "../Services/notificationService.js"
// import auditService from "../Services/AuditService.js"
// import logger from "../utils/logger.js"
// import { generateTransactionId } from "../helpers/randString.js"
// import {config} from "../../config/index.js"
// import ScheduledTransaction from "../Models/ScheduledTransaction.js"

// Laravel-style transaction controller
import Transaction from "../models/Transaction"
import Account from "../models/Account"
import User from "../models/User"
import transactionService from "../services/transactionService"
import notificationService from "../services/notificationService"
import auditService from "../services/auditService"
import logger from "../utils/logger"
import { generateTransactionId } from "../utils/helpers"
import ScheduledTransaction from "../models/ScheduledTransaction"
import RecurringTransaction from "../models/RecurringTransaction"
import ScheduledTransaction from "../models/ScheduledTransaction"
import ScheduledTransaction from "../models/ScheduledTransaction"
import RecurringTransaction from "../models/RecurringTransaction"
import config from "../config"

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

  // Get upcoming recurring transactions
  async getUpcomingRecurringTransactions(req, res) {
    try {
      const userId = req.user._id
      const { days = 7 } = req.query

      const endDate = new Date()
      endDate.setDate(endDate.getDate() + Number.parseInt(days))

      const upcomingTransactions = await RecurringTransaction.find({
        userId,
        status: "active",
        nextExecutionDate: { $lte: endDate },
      })
        .populate("fromAccount", "accountNumber accountType balance")
        .populate("toAccount", "accountNumber accountType")
        .sort({ nextExecutionDate: 1 })
        .limit(50)

      // Calculate total upcoming amount
      const totalUpcomingAmount = upcomingTransactions.reduce((sum, transaction) => {
        return sum + transaction.amount
      }, 0)

      res.status(200).json({
        status: "success",
        data: {
          upcomingTransactions,
          summary: {
            count: upcomingTransactions.length,
            totalAmount: totalUpcomingAmount,
            period: `${days} days`,
          },
        },
      })
    } catch (error) {
      logger.error("Get upcoming recurring transactions error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to get upcoming recurring transactions",
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
}

const transactionController = new TransactionController()

export default transactionController
