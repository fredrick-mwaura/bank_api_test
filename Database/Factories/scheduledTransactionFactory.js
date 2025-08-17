import mongoose from "mongoose"
import ScheduledTransaction from "../../app/Models/ScheduledTransaction.js"
import User from "../../app/Models/User.js"
import Account from "../../app/Models/Account.js"
import logger from "../../app/utils/logger.js"

class ScheduledTransactionFactory {
  constructor() {
    this.scheduledTransactions = []
  }

  /**
   * Generate sample scheduled transactions
   */
  async generateScheduledTransactions() {
    try {
      logger.info("Starting scheduled transaction seeding...")

      // Get existing users and accounts
      const users = await User.find({ status: "active" }).limit(10)
      const accounts = await Account.find({ status: "active" }).populate("userId")

      if (users.length === 0 || accounts.length === 0) {
        logger.warn("No active users or accounts found. Please seed users and accounts first.")
        return
      }

      // Clear existing scheduled transactions in development
      if (process.env.NODE_ENV !== "production") {
        await ScheduledTransaction.deleteMany({})
        logger.info("Cleared existing scheduled transactions")
      }

      // Generate different types of scheduled transactions
      await this.generateRecurringTransfers(users, accounts)
      await this.generateBillPayments(users, accounts)
      await this.generateSavingsTransfers(users, accounts)
      await this.generateLoanPayments(users, accounts)
      await this.generateInvestmentTransfers(users, accounts)

      // Insert all scheduled transactions
      if (this.scheduledTransactions.length > 0) {
        await ScheduledTransaction.insertMany(this.scheduledTransactions)
        logger.info(`Successfully seeded ${this.scheduledTransactions.length} scheduled transactions`)
      }

      return this.scheduledTransactions.length
    } catch (error) {
      logger.error("Error seeding scheduled transactions:", error)
      throw error
    }
  }

  /**
   * Generate recurring transfers between accounts
   */
  async generateRecurringTransfers(users, accounts) {
    const frequencies = ["weekly", "bi_weekly", "monthly"]
    const amounts = [100, 250, 500, 1000, 1500]

    for (let i = 0; i < 15; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const userAccounts = accounts.filter((acc) => acc.userId._id.toString() === user._id.toString())

      if (userAccounts.length < 2) continue

      const fromAccount = userAccounts[0]
      const toAccount = userAccounts[1]
      const frequency = frequencies[Math.floor(Math.random() * frequencies.length)]
      const amount = amounts[Math.floor(Math.random() * amounts.length)]

      const startDate = new Date()
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30)) // Start within next 30 days

      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 12) // End after 1 year

      this.scheduledTransactions.push({
        userId: user._id,
        accountId: fromAccount._id,
        type: "transfer",
        category: "savings",
        amount,
        currency: "USD",
        recipientType: "internal",
        recipientAccountId: toAccount._id,
        frequency,
        startDate,
        endDate,
        nextExecutionDate: startDate,
        maxExecutions: this.calculateMaxExecutions(frequency, startDate, endDate),
        description: `Recurring transfer from ${fromAccount.accountType} to ${toAccount.accountType}`,
        reference: `AUTO-TRANSFER-${Date.now()}-${i}`,
        tags: ["recurring", "savings", "automatic"],
        notificationSettings: {
          beforeExecution: {
            enabled: Math.random() > 0.5,
            daysBefore: 1,
          },
          afterExecution: {
            enabled: true,
          },
          onFailure: {
            enabled: true,
          },
        },
        createdBy: user._id,
        metadata: new Map([
          ["seeded", true],
          ["seedDate", new Date()],
          ["category", "recurring_transfer"],
        ]),
      })
    }
  }

  /**
   * Generate bill payments
   */
  async generateBillPayments(users, accounts) {
    const billTypes = [
      { name: "Electric Company", category: "utilities", amount: [80, 120, 150, 200] },
      { name: "Water & Sewer", category: "utilities", amount: [45, 65, 85, 110] },
      { name: "Internet Service", category: "utilities", amount: [60, 80, 100, 120] },
      { name: "Phone Service", category: "utilities", amount: [40, 60, 80, 100] },
      { name: "Rent Payment", category: "rent", amount: [800, 1200, 1500, 2000] },
      { name: "Car Insurance", category: "insurance", amount: [100, 150, 200, 250] },
      { name: "Health Insurance", category: "insurance", amount: [200, 300, 400, 500] },
      { name: "Netflix Subscription", category: "subscription", amount: [15, 20] },
      { name: "Spotify Premium", category: "subscription", amount: [10, 15] },
      { name: "Gym Membership", category: "subscription", amount: [30, 50, 70] },
    ]

    for (let i = 0; i < 25; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const userAccounts = accounts.filter((acc) => acc.userId._id.toString() === user._id.toString())

      if (userAccounts.length === 0) continue

      const account = userAccounts[Math.floor(Math.random() * userAccounts.length)]
      const billType = billTypes[Math.floor(Math.random() * billTypes.length)]
      const amount = billType.amount[Math.floor(Math.random() * billType.amount.length)]

      const startDate = new Date()
      startDate.setDate(1) // Start on first of month
      if (Math.random() > 0.5) {
        startDate.setMonth(startDate.getMonth() + 1) // Some start next month
      }

      this.scheduledTransactions.push({
        userId: user._id,
        accountId: account._id,
        type: "bill_payment",
        category: billType.category,
        amount,
        currency: "USD",
        recipientType: "bill_payee",
        recipientDetails: {
          name: billType.name,
          accountNumber: this.generateAccountNumber(),
          address: {
            street: `${Math.floor(Math.random() * 9999) + 1} Main St`,
            city: "Anytown",
            state: "CA",
            zipCode: "90210",
            country: "USA",
          },
        },
        frequency: "monthly",
        startDate,
        nextExecutionDate: startDate,
        description: `Monthly ${billType.name} payment`,
        reference: `BILL-${billType.name.replace(/\s+/g, "").toUpperCase()}-${i}`,
        memo: `Automatic payment for ${billType.name}`,
        tags: ["bill", "automatic", billType.category],
        notificationSettings: {
          beforeExecution: {
            enabled: true,
            daysBefore: 3,
          },
          afterExecution: {
            enabled: true,
          },
          onFailure: {
            enabled: true,
          },
        },
        createdBy: user._id,
        metadata: new Map([
          ["seeded", true],
          ["seedDate", new Date()],
          ["category", "bill_payment"],
          ["payee", billType.name],
        ]),
      })
    }
  }

  /**
   * Generate savings transfers
   */
  async generateSavingsTransfers(users, accounts) {
    const savingsAmounts = [50, 100, 200, 300, 500]
    const frequencies = ["weekly", "bi_weekly", "monthly"]

    for (let i = 0; i < 12; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const userAccounts = accounts.filter((acc) => acc.userId._id.toString() === user._id.toString())

      const checkingAccount = userAccounts.find((acc) => acc.accountType === "checking")
      const savingsAccount = userAccounts.find((acc) => acc.accountType === "savings")

      if (!checkingAccount || !savingsAccount) continue

      const amount = savingsAmounts[Math.floor(Math.random() * savingsAmounts.length)]
      const frequency = frequencies[Math.floor(Math.random() * frequencies.length)]

      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 7) // Start next week

      this.scheduledTransactions.push({
        userId: user._id,
        accountId: checkingAccount._id,
        type: "transfer",
        category: "savings",
        amount,
        currency: "USD",
        recipientType: "internal",
        recipientAccountId: savingsAccount._id,
        frequency,
        startDate,
        nextExecutionDate: startDate,
        description: "Automatic savings transfer",
        reference: `SAVINGS-AUTO-${i}`,
        memo: "Building emergency fund",
        tags: ["savings", "automatic", "emergency-fund"],
        notificationSettings: {
          beforeExecution: {
            enabled: false,
          },
          afterExecution: {
            enabled: true,
          },
          onFailure: {
            enabled: true,
          },
        },
        createdBy: user._id,
        metadata: new Map([
          ["seeded", true],
          ["seedDate", new Date()],
          ["category", "savings_transfer"],
          ["goal", "emergency_fund"],
        ]),
      })
    }
  }

  /**
   * Generate loan payments
   */
  async generateLoanPayments(users, accounts) {
    const loanTypes = [
      { name: "Car Loan", amount: [250, 350, 450, 550] },
      { name: "Student Loan", amount: [150, 250, 350, 500] },
      { name: "Personal Loan", amount: [100, 200, 300, 400] },
      { name: "Credit Card Payment", amount: [50, 100, 200, 300] },
    ]

    for (let i = 0; i < 10; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const userAccounts = accounts.filter((acc) => acc.userId._id.toString() === user._id.toString())

      if (userAccounts.length === 0) continue

      const account = userAccounts[Math.floor(Math.random() * userAccounts.length)]
      const loanType = loanTypes[Math.floor(Math.random() * loanTypes.length)]
      const amount = loanType.amount[Math.floor(Math.random() * loanType.amount.length)]

      const startDate = new Date()
      startDate.setDate(15) // Payment on 15th of each month
      if (startDate < new Date()) {
        startDate.setMonth(startDate.getMonth() + 1)
      }

      const endDate = new Date(startDate)
      endDate.setFullYear(endDate.getFullYear() + Math.floor(Math.random() * 5) + 1) // 1-5 years

      this.scheduledTransactions.push({
        userId: user._id,
        accountId: account._id,
        type: "loan_payment",
        category: "loan",
        amount,
        currency: "USD",
        recipientType: "external",
        recipientDetails: {
          name: `${loanType.name} Servicer`,
          accountNumber: this.generateAccountNumber(),
          routingNumber: this.generateRoutingNumber(),
          bankName: "Loan Servicing Bank",
          address: {
            street: "123 Loan St",
            city: "Finance City",
            state: "NY",
            zipCode: "10001",
            country: "USA",
          },
        },
        frequency: "monthly",
        startDate,
        endDate,
        nextExecutionDate: startDate,
        maxExecutions: this.calculateMaxExecutions("monthly", startDate, endDate),
        description: `Monthly ${loanType.name} payment`,
        reference: `LOAN-${loanType.name.replace(/\s+/g, "").toUpperCase()}-${i}`,
        tags: ["loan", "debt", "automatic"],
        requiresApproval: amount > 500, // Large loan payments require approval
        notificationSettings: {
          beforeExecution: {
            enabled: true,
            daysBefore: 2,
          },
          afterExecution: {
            enabled: true,
          },
          onFailure: {
            enabled: true,
          },
        },
        createdBy: user._id,
        metadata: new Map([
          ["seeded", true],
          ["seedDate", new Date()],
          ["category", "loan_payment"],
          ["loanType", loanType.name],
        ]),
      })
    }
  }

  /**
   * Generate investment transfers
   */
  async generateInvestmentTransfers(users, accounts) {
    const investmentAmounts = [100, 250, 500, 1000]
    const frequencies = ["weekly", "monthly"]

    for (let i = 0; i < 8; i++) {
      const user = users[Math.floor(Math.random() * users.length)]
      const userAccounts = accounts.filter((acc) => acc.userId._id.toString() === user._id.toString())

      if (userAccounts.length === 0) continue

      const account = userAccounts[Math.floor(Math.random() * userAccounts.length)]
      const amount = investmentAmounts[Math.floor(Math.random() * investmentAmounts.length)]
      const frequency = frequencies[Math.floor(Math.random() * frequencies.length)]

      const startDate = new Date()
      startDate.setDate(startDate.getDate() + 14) // Start in 2 weeks

      this.scheduledTransactions.push({
        userId: user._id,
        accountId: account._id,
        type: "investment",
        category: "investment",
        amount,
        currency: "USD",
        recipientType: "external",
        recipientDetails: {
          name: "Investment Brokerage",
          accountNumber: this.generateAccountNumber(),
          routingNumber: this.generateRoutingNumber(),
          bankName: "Investment Bank",
          address: {
            street: "456 Wall St",
            city: "New York",
            state: "NY",
            zipCode: "10005",
            country: "USA",
          },
        },
        frequency,
        startDate,
        nextExecutionDate: startDate,
        description: "Automatic investment contribution",
        reference: `INVEST-AUTO-${i}`,
        memo: "Dollar cost averaging strategy",
        tags: ["investment", "automatic", "retirement"],
        notificationSettings: {
          beforeExecution: {
            enabled: false,
          },
          afterExecution: {
            enabled: true,
          },
          onFailure: {
            enabled: true,
          },
        },
        createdBy: user._id,
        metadata: new Map([
          ["seeded", true],
          ["seedDate", new Date()],
          ["category", "investment_transfer"],
          ["strategy", "dollar_cost_averaging"],
        ]),
      })
    }
  }

  /**
   * Calculate maximum executions based on frequency and date range
   */
  calculateMaxExecutions(frequency, startDate, endDate) {
    if (!endDate) return null

    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    switch (frequency) {
      case "daily":
        return diffDays
      case "weekly":
        return Math.floor(diffDays / 7)
      case "bi_weekly":
        return Math.floor(diffDays / 14)
      case "monthly":
        return Math.floor(diffDays / 30)
      case "quarterly":
        return Math.floor(diffDays / 90)
      case "semi_annually":
        return Math.floor(diffDays / 180)
      case "annually":
        return Math.floor(diffDays / 365)
      default:
        return 1
    }
  }

  /**
   * Generate random account number
   */
  generateAccountNumber() {
    return Math.floor(Math.random() * 9000000000) + 1000000000
  }

  /**
   * Generate random routing number
   */
  generateRoutingNumber() {
    const routingNumbers = [
      "021000021",
      "011401533",
      "111000025",
      "121000248",
      "026009593",
      "121042882",
      "031201360",
      "053000196",
      "067014822",
      "091000019",
    ]
    return routingNumbers[Math.floor(Math.random() * routingNumbers.length)]
  }

  /**
   * Seed scheduled transactions with some already executed
   */
  async seedWithExecutionHistory() {
    try {
      const scheduledTransactions = await ScheduledTransaction.find({ status: "active" }).limit(10)

      for (const scheduledTx of scheduledTransactions) {
        // Randomly execute some transactions
        if (Math.random() > 0.7) {
          const executionCount = Math.floor(Math.random() * 3) + 1

          scheduledTx.executionCount = executionCount
          scheduledTx.lastExecutedAt = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Within last 30 days
          scheduledTx.lastExecutionResult = {
            success: Math.random() > 0.1, // 90% success rate
            transactionId: new mongoose.Types.ObjectId(),
            executedAt: scheduledTx.lastExecutedAt,
          }

          // Update next execution date
          scheduledTx.updateNextExecution()
          await scheduledTx.save()
        }
      }

      logger.info("Added execution history to scheduled transactions")
    } catch (error) {
      logger.error("Error seeding execution history:", error)
    }
  }

  /**
   * Run the complete seeding process
   */
  async seed() {
    try {
      const count = await this.generateScheduledTransactions()
      await this.seedWithExecutionHistory()

      logger.info(`Scheduled transaction seeding completed. Created ${count} scheduled transactions.`)
      return count
    } catch (error) {
      logger.error("Scheduled transaction seeding failed:", error)
      throw error
    }
  }
}

const hehe = new ScheduledTransactionFactory();

