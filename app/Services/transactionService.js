import Transaction from "../models/Transaction.js"
import Account from "../models/Account.js"
import mongoose from "mongoose"
import logger from "../utils/logger.js"
import { generateTransactionId } from "../utils/helpers/randString.js"
import config from "../config"

// Laravel-style transaction service
class TransactionService {
  // Execute transfer between accounts
  async executeTransfer({ fromAccount, toAccount, amount, description, category, userId, type }) {
    const session = await mongoose.startSession()

    try {
      session.startTransaction()

      // Generate unique transaction ID
      const transactionId = generateTransactionId()

      // Create transaction record
      const transaction = new Transaction({
        transactionId,
        type,
        amount,
        description,
        category,
        fromAccount: fromAccount._id,
        toAccount: toAccount._id,
        userId,
        status: "completed",
        balanceAfter: fromAccount.balance - amount,
      })

      // Update account balances
      fromAccount.balance -= amount
      toAccount.balance += amount

      // Save all changes
      await transaction.save({ session })
      await fromAccount.save({ session })
      await toAccount.save({ session })

      await session.commitTransaction()

      logger.info("Transfer completed successfully", {
        transactionId,
        fromAccount: fromAccount.accountNumber,
        toAccount: toAccount.accountNumber,
        amount,
        userId,
      })

      return {
        transaction,
        fromAccountBalance: fromAccount.balance,
        toAccountBalance: toAccount.balance,
      }
    } catch (error) {
      await session.abortTransaction()
      logger.error("Transfer failed:", error)
      throw error
    } finally {
      session.endSession()
    }
  }

  // Execute internal transfer
  async executeInternalTransfer({ fromAccount, toAccount, amount, description, userId }) {
    return this.executeTransfer({
      fromAccount,
      toAccount,
      amount,
      description,
      category: "internal_transfer",
      userId,
      type: "internal_transfer",
    })
  }

  // Execute external transfer
  async executeExternalTransfer({
    fromAccount,
    recipientBankCode,
    recipientAccountNumber,
    recipientName,
    amount,
    fees,
    description,
    transferType,
    userId,
  }) {
    const session = await mongoose.startSession()

    try {
      session.startTransaction()

      const transactionId = generateTransactionId()
      const totalAmount = amount + fees

      // Create main transaction
      const transaction = new Transaction({
        transactionId,
        type: "external_transfer",
        amount,
        description,
        fromAccount: fromAccount._id,
        userId,
        status: transferType === "instant" ? "completed" : "pending",
        balanceAfter: fromAccount.balance - totalAmount,
        metadata: {
          recipientBankCode,
          recipientAccountNumber,
          recipientName,
          transferType,
          fees,
        },
      })

      // Create fee transaction if applicable
      if (fees > 0) {
        const feeTransaction = new Transaction({
          transactionId: generateTransactionId(),
          type: "fee",
          amount: fees,
          description: `Transfer fee for ${transactionId}`,
          fromAccount: fromAccount._id,
          userId,
          status: "completed",
          balanceAfter: fromAccount.balance - totalAmount,
          metadata: {
            relatedTransaction: transactionId,
            feeType: "transfer_fee",
          },
        })

        await feeTransaction.save({ session })
      }

      // Update account balance
      fromAccount.balance -= totalAmount

      await transaction.save({ session })
      await fromAccount.save({ session })

      await session.commitTransaction()

      // Calculate estimated arrival time
      const estimatedArrival = this.calculateEstimatedArrival(transferType)

      return {
        transaction,
        estimatedArrival,
        fromAccountBalance: fromAccount.balance,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  // Execute deposit
  async executeDeposit({ account, amount, description, depositType, userId }) {
    const session = await mongoose.startSession()

    try {
      session.startTransaction()

      const transactionId = generateTransactionId()

      const transaction = new Transaction({
        transactionId,
        type: "deposit",
        amount,
        description,
        toAccount: account._id,
        userId,
        status: depositType === "check" ? "pending" : "completed",
        balanceAfter: account.balance + amount,
        metadata: { depositType },
      })

      // Update account balance (for check deposits, might be held)
      if (depositType !== "check") {
        account.balance += amount
      }

      await transaction.save({ session })
      await account.save({ session })

      await session.commitTransaction()

      return {
        transaction,
        accountBalance: account.balance,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  // Execute withdrawal
  async executeWithdrawal({ account, amount, description, withdrawalType, userId }) {
    const session = await mongoose.startSession()

    try {
      session.startTransaction()

      const transactionId = generateTransactionId()

      const transaction = new Transaction({
        transactionId,
        type: "withdrawal",
        amount,
        description,
        fromAccount: account._id,
        userId,
        status: "completed",
        balanceAfter: account.balance - amount,
        metadata: { withdrawalType },
      })

      account.balance -= amount

      await transaction.save({ session })
      await account.save({ session })

      await session.commitTransaction()

      return {
        transaction,
        accountBalance: account.balance,
      }
    } catch (error) {
      await session.abortTransaction()
      throw error
    } finally {
      session.endSession()
    }
  }

  // Check transaction limits
  async checkTransactionLimits(account, amount, transactionType) {
    const today = new Date()
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // Get daily transactions
    const dailyTransactions = await Transaction.aggregate([
      {
        $match: {
          fromAccount: account._id,
          createdAt: { $gte: startOfDay },
          status: { $in: ["completed", "pending"] },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ])

    const dailyTotal = dailyTransactions[0]?.totalAmount || 0

    // Get monthly transactions
    const monthlyTransactions = await Transaction.aggregate([
      {
        $match: {
          fromAccount: account._id,
          createdAt: { $gte: startOfMonth },
          status: { $in: ["completed", "pending"] },
        },
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
        },
      },
    ])

    const monthlyTotal = monthlyTransactions[0]?.totalAmount || 0

    // Check limits
    if (dailyTotal + amount > account.dailyTransactionLimit) {
      return {
        allowed: false,
        reason: `Daily transaction limit of $${account.dailyTransactionLimit} would be exceeded`,
      }
    }

    if (monthlyTotal + amount > account.monthlyTransactionLimit) {
      return {
        allowed: false,
        reason: `Monthly transaction limit of $${account.monthlyTransactionLimit} would be exceeded`,
      }
    }

    if (amount > config.banking.maxTransactionAmount) {
      return {
        allowed: false,
        reason: `Transaction amount exceeds maximum limit of $${config.banking.maxTransactionAmount}`,
      }
    }

    return { allowed: true }
  }

  // Calculate transfer fees
  async calculateTransferFees(amount, transferType, transferCategory) {
    const feeRates = {
      internal: 0,
      external: {
        standard: 2.5,
        express: 5.0,
        instant: 10.0,
      },
    }

    if (transferCategory === "internal") {
      return 0
    }

    return feeRates.external[transferType] || feeRates.external.standard
  }

  // Calculate estimated arrival time
  calculateEstimatedArrival(transferType) {
    const now = new Date()

    switch (transferType) {
      case "instant":
        return new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes
      case "express":
        return new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 hours
      case "standard":
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours
    }
  }

  // Verify transaction access
  async verifyTransactionAccess(transaction, userId) {
    // User can access transaction if they own either account involved
    const userAccounts = await Account.find({ userId }).select("_id")
    const userAccountIds = userAccounts.map((acc) => acc._id.toString())

    return (
      userAccountIds.includes(transaction.fromAccount?.toString()) ||
      userAccountIds.includes(transaction.toAccount?.toString()) ||
      transaction.userId?.toString() === userId.toString()
    )
  }

  // Get transaction analytics
  async getTransactionAnalytics(userId, period, accountId) {
    const dateRange = this.getDateRange(period)

    const matchStage = {
      userId: new mongoose.Types.ObjectId(userId),
      createdAt: { $gte: dateRange.start, $lte: dateRange.end },
    }

    if (accountId) {
      matchStage.$or = [
        { fromAccount: new mongoose.Types.ObjectId(accountId) },
        { toAccount: new mongoose.Types.ObjectId(accountId) },
      ]
    }

    const analytics = await Transaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
          deposits: {
            $sum: {
              $cond: [{ $eq: ["$type", "deposit"] }, "$amount", 0],
            },
          },
          withdrawals: {
            $sum: {
              $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0],
            },
          },
          transfers: {
            $sum: {
              $cond: [{ $in: ["$type", ["transfer", "internal_transfer"]] }, "$amount", 0],
            },
          },
        },
      },
    ])

    return (
      analytics[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        avgAmount: 0,
        deposits: 0,
        withdrawals: 0,
        transfers: 0,
      }
    )
  }

  // Get date range for analytics
  getDateRange(period) {
    const now = new Date()
    const start = new Date()

    switch (period) {
      case "7d":
        start.setDate(now.getDate() - 7)
        break
      case "30d":
        start.setDate(now.getDate() - 30)
        break
      case "90d":
        start.setDate(now.getDate() - 90)
        break
      case "1y":
        start.setFullYear(now.getFullYear() - 1)
        break
      default:
        start.setDate(now.getDate() - 30)
    }

    return { start, end: now }
  }
}

module.exports = new TransactionService()
