import nodemailer from "nodemailer"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import logger from "../utils/logger.js"
import { config } from "../../config/index.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Laravel-style email service for banking notifications
class EmailService {
  constructor() {
    this.transporter = null
    this.templates = new Map()
    this.initializeTransporter()
  }

  // Initialize email transporter
  async initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.mail.host,
        port: config.mail.port,
        secure: config.mail.port === 465, // true for 465, false for other ports
        auth: {
          user: config.mail.username ?? '',//fredrickmwaura691@gmailcom
          pass: config.mail.password ?? "", //sdvofrpatinaujjl
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === "production",
        },
      })

      // Verify connection
      await this.transporter.verify()
      logger.info("Email service initialized successfully")
    } catch (error) {
      logger.error("Failed to initialize email service:", error)
      throw error
    }
  }

  // Load email template
  async loadTemplate(templateName) {
    try {
      if (this.templates.has(templateName)) {
        return this.templates.get(templateName)
      }

      const templatePath = path.join(__dirname, "../../Resources/Views/mails", `${templateName}.html`)
      const template = await fs.readFile(templatePath, "utf-8")

      this.templates.set(templateName, template)
      return template
    } catch (error) {
      logger.error(`Failed to load email template ${templateName}:`, error)
      throw error
    }
  }

  // Replace template variables
  replaceTemplateVariables(template, variables) {
    let processedTemplate = template

    Object.keys(variables).forEach((key) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g")
      processedTemplate = processedTemplate.replace(regex, variables[key] || "")
    })

    return processedTemplate
  }

  // Send email with template
  async sendTemplateEmail(to, subject, templateName, variables = {}) {
    try {
      const template = await this.loadTemplate(templateName)
      const html = this.replaceTemplateVariables(template, {
        ...variables,
        appName: config.app.name,
        appUrl: config.app.url,
        supportEmail: config.mail.from.address,
        currentYear: new Date().getFullYear(),
      })

      const mailOptions = {
        from: {
          name: config.mail.from.name,
          address: config.mail.from.address,
        },
        to,
        subject,
        html,
      }

      const result = await this.transporter.sendMail(mailOptions)

      logger.info("Email sent successfully", {
        to,
        subject,
        template: templateName,
        messageId: result.messageId,
      })

      return result
    } catch (error) {
      logger.error("Failed to send template email:", error)
      throw error
    }
  }

  // Send plain email
  async sendEmail({ to, subject, text, html, attachments = [] }) {
    try {
      const mailOptions = {
        from: {
          name: config.mail.from.name,
          address: config.mail.from.address,
        },
        to,
        subject,
        text,
        html,
        attachments,
      }

      const result = await this.transporter.sendMail(mailOptions)

      logger.info("Email sent successfully", {
        to,
        subject,
        messageId: result.messageId,
      })

      return result
    } catch (error) {
      logger.error("Failed to send email:", error)
      throw error
    }
  }

  // Send verification email
  async sendVerificationEmail(email, token) {
    const verificationUrl = `${config.app.url}/api/auth/verify-email/token=${token}`

    return this.sendTemplateEmail(email, "Verify Your Email Address", "email-verification", {
      verificationUrl,
      email,
    })
  }

  // Send welcome email
  async sendWelcomeEmail(email, firstName) {
    return this.sendTemplateEmail(email, "Welcome to Our Banking Platform", "welcome", {
      firstName,
      email,
      loginUrl: `${config.app.url}/login`,
    })
  }

  // Send password reset email
  async sendPasswordResetEmail(email, token) {
    const resetUrl = `${config.app.url}/reset-password/token=${token}`

    return this.sendTemplateEmail(email, "Reset Your Password", "password-reset", {
      resetUrl,
      email,
      expirationTime: "1 hour",
    })
  }

  // Send password reset confirmation
  async sendPasswordResetConfirmation(email) {
    return this.sendTemplateEmail(email, "Password Reset Successful", "password-reset-confirmation", {
      email,
      loginUrl: `${config.app.url}/login`,
    })
  }

  // Send transaction notification
  async sendTransactionNotification(email, transactionData) {
    const { type, amount, description, accountNumber, balance, timestamp } = transactionData

    const templates = {
      transfer_sent: "transaction-transfer-sent",
      transfer_received: "transaction-transfer-received",
      deposit_received: "transaction-deposit",
      withdrawal_completed: "transaction-withdrawal",
      payment_completed: "transaction-payment",
    }

    const subjects = {
      transfer_sent: "Money Transfer Sent",
      transfer_received: "Money Transfer Received",
      deposit_received: "Deposit Received",
      withdrawal_completed: "Withdrawal Completed",
      payment_completed: "Payment Completed",
    }

    const templateName = templates[type] || "transaction-generic"
    const subject = subjects[type] || "Transaction Notification"

    return this.sendTemplateEmail(email, subject, templateName, {
      amount: this.formatCurrency(amount),
      description,
      accountNumber: this.maskAccountNumber(accountNumber),
      balance: this.formatCurrency(balance),
      timestamp: this.formatDate(timestamp),
      transactionType: type.replace("_", " ").toUpperCase(),
    })
  }

  // Send account notification
  async sendAccountNotification(email, notificationData) {
    const { type, accountNumber, accountType, message } = notificationData

    const templates = {
      account_created: "account-created",
      account_activated: "account-activated",
      account_suspended: "account-suspended",
      account_closed: "account-closed",
      limit_exceeded: "account-limit-exceeded",
    }

    const subjects = {
      account_created: "New Account Created",
      account_activated: "Account Activated",
      account_suspended: "Account Suspended",
      account_closed: "Account Closed",
      limit_exceeded: "Transaction Limit Exceeded",
    }

    const templateName = templates[type] || "account-generic"
    const subject = subjects[type] || "Account Notification"

    return this.sendTemplateEmail(email, subject, templateName, {
      accountNumber: this.maskAccountNumber(accountNumber),
      accountType: accountType?.toUpperCase(),
      message,
    })
  }

  // Send security alert
  async sendSecurityAlert(email, alertData) {
    const { type, ipAddress, location, timestamp, action } = alertData

    const templates = {
      login_from_new_device: "security-new-device",
      login_from_new_location: "security-new-location",
      password_changed: "security-password-changed",
      suspicious_activity: "security-suspicious-activity",
      account_locked: "security-account-locked",
    }

    const subjects = {
      login_from_new_device: "New Device Login Detected",
      login_from_new_location: "New Location Login Detected",
      password_changed: "Password Changed",
      suspicious_activity: "Suspicious Activity Detected",
      account_locked: "Account Temporarily Locked",
    }

    const templateName = templates[type] || "security-generic"
    const subject = subjects[type] || "Security Alert"

    return this.sendTemplateEmail(email, subject, templateName, {
      ipAddress,
      location,
      timestamp: this.formatDate(timestamp),
      action,
    })
  }

  // Send statement email
  async sendStatementEmail(email, statementData, attachmentPath) {
    const { accountNumber, period, balance } = statementData

    const attachments = []
    if (attachmentPath) {
      attachments.push({
        filename: `statement-${period}.pdf`,
        path: attachmentPath,
        contentType: "application/pdf",
      })
    }

    return this.sendEmail({
      to: email,
      subject: `Account Statement - ${period}`,
      html: await this.loadTemplate("account-statement").then((template) =>
        this.replaceTemplateVariables(template, {
          accountNumber: this.maskAccountNumber(accountNumber),
          period,
          balance: this.formatCurrency(balance),
        }),
      ),
      attachments,
    })
  }

  // Send bulk notification
  async sendBulkNotification(recipients, subject, templateName, variables = {}) {
    const results = []

    for (const recipient of recipients) {
      try {
        const result = await this.sendTemplateEmail(recipient.email, subject, templateName, {
          ...variables,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
        })

        results.push({
          email: recipient.email,
          success: true,
          messageId: result.messageId,
        })
      } catch (error) {
        logger.error(`Failed to send bulk email to ${recipient.email}:`, error)
        results.push({
          email: recipient.email,
          success: false,
          error: error.message,
        })
      }

      // Add delay to prevent rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    return results
  }

  // Send OTP email
  async sendOTPEmail(email, otp, purpose = "verification") {
    return this.sendTemplateEmail(email, `Your OTP Code - ${otp}`, "otp", {
      otp,
      purpose,
      expirationTime: "10 minutes",
    })
  }

  // Send maintenance notification
  async sendMaintenanceNotification(email, maintenanceData) {
    const { startTime, endTime, description, affectedServices } = maintenanceData

    return this.sendTemplateEmail(email, "Scheduled Maintenance Notification", "maintenance", {
      startTime: this.formatDate(startTime),
      endTime: this.formatDate(endTime),
      description,
      affectedServices: affectedServices.join(", "),
    })
  }

  // Utility methods
  formatCurrency(amount, currency = "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount)
  }

  formatDate(date) {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(date))
  }

  maskAccountNumber(accountNumber) {
    if (!accountNumber) return ""
    const str = accountNumber.toString()
    return str.length > 4 ? `****${str.slice(-4)}` : str
  }

  // Test email configuration
  async testEmailConfiguration() {
    try {
      await this.transporter.verify()
      return { success: true, message: "Email configuration is valid" }
    } catch (error) {
      return { success: false, message: error.message }
    }
  }

  // Get email statistics
  async getEmailStatistics(days = 30) {
    // This would typically query a database table that tracks sent emails
    // For now, return a placeholder structure
    return {
      totalSent: 0,
      totalFailed: 0,
      successRate: 0,
      topTemplates: [],
      period: `${days} days`,
    }
  }
}

// Create singleton instance
const emailService = new EmailService()

// Export individual methods for convenience
export const sendEmail = emailService.sendEmail.bind(emailService)
export const sendTemplateEmail = emailService.sendTemplateEmail.bind(emailService)
export const sendVerificationEmail = emailService.sendVerificationEmail.bind(emailService)
export const sendWelcomeEmail = emailService.sendWelcomeEmail.bind(emailService)
export const sendPasswordResetEmail = emailService.sendPasswordResetEmail.bind(emailService)
export const sendPasswordResetConfirmation = emailService.sendPasswordResetConfirmation.bind(emailService)
export const sendTransactionNotification = emailService.sendTransactionNotification.bind(emailService)
export const sendAccountNotification = emailService.sendAccountNotification.bind(emailService)
export const sendSecurityAlert = emailService.sendSecurityAlert.bind(emailService)
export const sendStatementEmail = emailService.sendStatementEmail.bind(emailService)
export const sendBulkNotification = emailService.sendBulkNotification.bind(emailService)
export const sendOTPEmail = emailService.sendOTPEmail.bind(emailService)
export const sendMaintenanceNotification = emailService.sendMaintenanceNotification.bind(emailService)
export const testEmailConfiguration = emailService.testEmailConfiguration.bind(emailService)
export const getEmailStatistics = emailService.getEmailStatistics.bind(emailService)


//   console.log(config.mail.username )
// console.log(' ,config.mail.password )
export default emailService
