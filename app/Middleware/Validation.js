import { body, param, query, validationResult } from "express-validator"

// Laravel-style validation middleware
export class ValidationMiddleware {
  // Handle validation results (Laravel-style validation response)
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req)

    if (!errors.isEmpty()) {
      const formattedErrors = {}

      errors.array().forEach((error) => {
        if (!formattedErrors[error.path]) {
          formattedErrors[error.path] = []
        }
        formattedErrors[error.path].push(error.msg)
      })

      return res.status(422).json({
        status: "error",
        message: "Validation failed",
        errors: formattedErrors,
      })
    }

    next()
  }

  // User registration validation rules
  static validateRegistration() {
    return [
      body("firstName")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("First name must be between 2 and 50 characters")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("First name can only contain letters and spaces"),

      body("lastName")
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Last name must be between 2 and 50 characters")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("Last name can only contain letters and spaces"),

      body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email address"),

      body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage(
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        ),

      body("phoneNumber").isMobilePhone().withMessage("Please provide a valid phone number"),

      body("dateOfBirth")
        .isISO8601()
        .withMessage("Please provide a valid date of birth")
        .custom((value) => {
          const age = new Date().getFullYear() - new Date(value).getFullYear()
          if (age < 18) {
            throw new Error("You must be at least 18 years old")
          }
          return true
        }),

      body("snn")
        .matches(/^\d{3}-\d{2}-\d{4}$/)
        .withMessage("snn must be in format XXX-XX-XXXX"),

      this.handleValidationErrors,
    ]
  }

  static validateAdminRegistration() {
    return [
      body["email"].isEmail().normalizeEmail().withMessage("please provide a valid email address"),
      body["password"].isNotEmpty().withMessage("Password is required"),
    ]
  }

  // Login validation rules
  static validateLogin() {
    return [
      body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email address"),

      body("password").notEmpty().withMessage("Password is required"),

      this.handleValidationErrors,
    ]
  }

  // Transaction validation rules
  static validateTransaction() {
    return [
      body("amount").isFloat({ min: 0.01, max: 1000000 }).withMessage("Amount must be between $0.01 and $1,000,000"),

      body("description")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("toAccount").optional().isMongoId().withMessage("Invalid account ID format"),

      body("category")
        .optional()
        .isIn(["food", "transport", "utilities", "entertainment", "healthcare", "shopping", "other"])
        .withMessage("Invalid transaction category"),

      this.handleValidationErrors,
    ]
  }

  // Account creation validation
  static validateAccountCreation() {
    return [
      body("accountType")
        .isIn(["checking", "savings", "business"])
        .withMessage("Account type must be checking, savings, or business"),

      body("initialDeposit").optional().isFloat({ min: 0 }).withMessage("Initial deposit must be a positive number"),

      this.handleValidationErrors,
    ]
  }

  // Password reset validation
  static validatePasswordReset() {
    return [
      body("email").isEmail().normalizeEmail().withMessage("Please provide a valid email address"),

      this.handleValidationErrors,
    ]
  }

  // New password validation
  static validateNewPassword() {
    return [
      body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage(
          "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        ),

      body("confirmPassword").custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Password confirmation does not match password")
        }
        return true
      }),

      this.handleValidationErrors,
    ]
  }

  // MongoDB ObjectId validation
  static validateObjectId(paramName = "id") {
    return [
      param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),

      this.handleValidationErrors,
    ]
  }

  // Pagination validation
  static validatePagination() {
    return [
      query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),

      query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),

      this.handleValidationErrors,
    ]
  }

  // Profile update validation
  static validateProfileUpdate() {
    return [
      body("firstName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("First name must be between 2 and 50 characters")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("First name can only contain letters and spaces"),

      body("lastName")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Last name must be between 2 and 50 characters")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("Last name can only contain letters and spaces"),

      body("phoneNumber").optional().isMobilePhone().withMessage("Please provide a valid phone number"),

      body("address.street")
        .optional()
        .trim()
        .isLength({ min: 5, max: 100 })
        .withMessage("Street address must be between 5 and 100 characters"),

      body("address.city")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("City must be between 2 and 50 characters")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("City can only contain letters and spaces"),

      body("address.state")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("State must be between 2 and 50 characters")
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage("State can only contain letters and spaces"),

      body("address.zipCode")
        .optional()
        .matches(/^\d{5}(-\d{4})?$/)
        .withMessage("ZIP code must be in format 12345 or 12345-6789"),

      body("address.country")
        .optional()
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage("Country must be between 2 and 50 characters"),

      body("preferences.currency")
        .optional()
        .isIn(["USD", "EUR", "GBP", "CAD", "AUD"])
        .withMessage("Currency must be one of: USD, EUR, GBP, CAD, AUD"),

      body("preferences.language")
        .optional()
        .isIn(["en", "es", "fr", "de", "it"])
        .withMessage("Language must be one of: en, es, fr, de, it"),

      body("preferences.timezone")
        .optional()
        .isLength({ min: 3, max: 50 })
        .withMessage("Timezone must be a valid timezone string"),

      body("preferences.notifications.email")
        .optional()
        .isBoolean()
        .withMessage("Email notification preference must be true or false"),

      body("preferences.notifications.sms")
        .optional()
        .isBoolean()
        .withMessage("SMS notification preference must be true or false"),

      body("preferences.notifications.push")
        .optional()
        .isBoolean()
        .withMessage("Push notification preference must be true or false"),

      this.handleValidationErrors,
    ]
  }

  // Password change validation
  static validatePasswordChange() {
    return [
      body("currentPassword").notEmpty().withMessage("Current password is required"),

      body("newPassword")
        .isLength({ min: 8 })
        .withMessage("New password must be at least 8 characters long")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage(
          "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        ),

      body("confirmNewPassword").custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error("Password confirmation does not match new password")
        }
        return true
      }),

      body("currentPassword").custom((value, { req }) => {
        if (value === req.body.newPassword) {
          throw new Error("New password must be different from current password")
        }
        return true
      }),

      this.handleValidationErrors,
    ]
  }

  // User filters validation for admin endpoints
  static validateUserFilters() {
    return [
      query("status")
        .optional()
        .isIn(["active", "inactive", "suspended", "closed"])
        .withMessage("Status must be one of: active, inactive, suspended, closed"),

      query("role")
        .optional()
        .isIn(["customer", "admin", "manager"])
        .withMessage("Role must be one of: customer, admin, manager"),

      query("search")
        .optional()
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage("Search term must be between 1 and 100 characters"),

      query("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO date"),

      query("endDate").optional().isISO8601().withMessage("End date must be a valid ISO date"),

      this.handleValidationErrors,
    ]
  }

  // Status update validation
  static validateStatusUpdate() {
    return [
      body("status")
        .isIn(["active", "inactive", "suspended", "closed"])
        .withMessage("Status must be one of: active, inactive, suspended, closed"),

      body("reason")
        .optional()
        .trim()
        .isLength({ min: 5, max: 200 })
        .withMessage("Reason must be between 5 and 200 characters"),

      this.handleValidationErrors,
    ]
  }

  // Notification filters validation
  static validateNotificationFilters() {
    return [
      query("type")
        .optional()
        .isIn(["transaction", "security", "account", "system", "marketing"])
        .withMessage("Type must be one of: transaction, security, account, system, marketing"),

      query("read").optional().isBoolean().withMessage("Read status must be true or false"),

      query("priority")
        .optional()
        .isIn(["low", "medium", "high", "urgent"])
        .withMessage("Priority must be one of: low, medium, high, urgent"),

      this.handleValidationErrors,
    ]
  }

  // Preferences validation
  static validatePreferences() {
    return [
      body("currency")
        .optional()
        .isIn(["USD", "EUR", "GBP", "CAD", "AUD"])
        .withMessage("Currency must be one of: USD, EUR, GBP, CAD, AUD"),

      body("language")
        .optional()
        .isIn(["en", "es", "fr", "de", "it"])
        .withMessage("Language must be one of: en, es, fr, de, it"),

      body("timezone").optional().isLength({ min: 3, max: 50 }).withMessage("Timezone must be a valid timezone string"),

      body("notifications.email")
        .optional()
        .isBoolean()
        .withMessage("Email notification preference must be true or false"),

      body("notifications.sms").optional().isBoolean().withMessage("SMS notification preference must be true or false"),

      body("notifications.push")
        .optional()
        .isBoolean()
        .withMessage("Push notification preference must be true or false"),

      body("theme").optional().isIn(["light", "dark", "auto"]).withMessage("Theme must be one of: light, dark, auto"),

      this.handleValidationErrors,
    ]
  }

  // Transaction filters validation
  static validateTransactionFilters() {
    return [
      query("type")
        .optional()
        .isIn(["transfer", "deposit", "withdrawal", "payment", "bill_payment", "atm", "check"])
        .withMessage("Type must be one of: transfer, deposit, withdrawal, payment, bill_payment, atm, check"),

      query("status")
        .optional()
        .isIn(["pending", "completed", "failed", "cancelled", "processing"])
        .withMessage("Status must be one of: pending, completed, failed, cancelled, processing"),

      query("category")
        .optional()
        .isIn(["food", "transport", "utilities", "entertainment", "healthcare", "shopping", "other"])
        .withMessage("Category must be one of: food, transport, utilities, entertainment, healthcare, shopping, other"),

      query("minAmount").optional().isFloat({ min: 0 }).withMessage("Minimum amount must be a positive number"),

      query("maxAmount").optional().isFloat({ min: 0 }).withMessage("Maximum amount must be a positive number"),

      query("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO date"),

      query("endDate").optional().isISO8601().withMessage("End date must be a valid ISO date"),

      query("accountId").optional().isMongoId().withMessage("Account ID must be a valid MongoDB ObjectId"),

      this.handleValidationErrors,
    ]
  }

  // Transfer validation
  static validateTransfer() {
    return [
      body("fromAccountId").isMongoId().withMessage("From account ID must be a valid MongoDB ObjectId"),

      body("toAccountId").isMongoId().withMessage("To account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 1000000 }).withMessage("Amount must be between $0.01 and $1,000,000"),

      body("description")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("category")
        .optional()
        .isIn(["food", "transport", "utilities", "entertainment", "healthcare", "shopping", "other"])
        .withMessage("Category must be one of: food, transport, utilities, entertainment, healthcare, shopping, other"),

      body("scheduledDate").optional().isISO8601().withMessage("Scheduled date must be a valid ISO date"),

      this.handleValidationErrors,
    ]
  }

  // Internal transfer validation
  static validateInternalTransfer() {
    return [
      body("fromAccountId").isMongoId().withMessage("From account ID must be a valid MongoDB ObjectId"),

      body("toAccountId").isMongoId().withMessage("To account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 1000000 }).withMessage("Amount must be between $0.01 and $1,000,000"),

      body("description")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("fromAccountId").custom((value, { req }) => {
        if (value === req.body.toAccountId) {
          throw new Error("Cannot transfer to the same account")
        }
        return true
      }),

      this.handleValidationErrors,
    ]
  }

  // External transfer validation
  static validateExternalTransfer() {
    return [
      body("fromAccountId").isMongoId().withMessage("From account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 50000 }).withMessage("Amount must be between $0.01 and $50,000"),

      body("recipientName")
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Recipient name must be between 2 and 100 characters"),

      body("recipientAccountNumber")
        .matches(/^\d{8,17}$/)
        .withMessage("Recipient account number must be 8-17 digits"),

      body("recipientRoutingNumber")
        .matches(/^\d{9}$/)
        .withMessage("Recipient routing number must be 9 digits"),

      body("recipientBankName")
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Recipient bank name must be between 2 and 100 characters"),

      body("description")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("transferType")
        .optional()
        .isIn(["wire", "ach", "same_day_ach"])
        .withMessage("Transfer type must be one of: wire, ach, same_day_ach"),

      this.handleValidationErrors,
    ]
  }

  // Deposit validation
  static validateDeposit() {
    return [
      body("accountId").isMongoId().withMessage("Account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 100000 }).withMessage("Amount must be between $0.01 and $100,000"),

      body("depositType")
        .isIn(["cash", "check", "wire", "direct_deposit", "mobile_deposit"])
        .withMessage("Deposit type must be one of: cash, check, wire, direct_deposit, mobile_deposit"),

      body("description")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Description must not exceed 200 characters"),

      body("referenceNumber")
        .optional()
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage("Reference number must be between 1 and 50 characters"),

      this.handleValidationErrors,
    ]
  }

  // Check deposit validation
  static validateCheckDeposit() {
    return [
      body("accountId").isMongoId().withMessage("Account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 25000 }).withMessage("Amount must be between $0.01 and $25,000"),

      body("checkNumber")
        .matches(/^\d{1,10}$/)
        .withMessage("Check number must be 1-10 digits"),

      body("routingNumber")
        .matches(/^\d{9}$/)
        .withMessage("Routing number must be 9 digits"),

      body("accountNumber")
        .matches(/^\d{8,17}$/)
        .withMessage("Account number must be 8-17 digits"),

      body("frontImage").notEmpty().withMessage("Front image of check is required"),

      body("backImage").notEmpty().withMessage("Back image of check is required"),

      body("memo").optional().trim().isLength({ max: 100 }).withMessage("Memo must not exceed 100 characters"),

      this.handleValidationErrors,
    ]
  }

  // Withdrawal validation
  static validateWithdrawal() {
    return [
      body("accountId").isMongoId().withMessage("Account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 10000 }).withMessage("Amount must be between $0.01 and $10,000"),

      body("withdrawalType")
        .isIn(["atm", "branch", "online", "check"])
        .withMessage("Withdrawal type must be one of: atm, branch, online, check"),

      body("description")
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage("Description must not exceed 200 characters"),

      body("pin")
        .optional()
        .matches(/^\d{4,6}$/)
        .withMessage("PIN must be 4-6 digits"),

      this.handleValidationErrors,
    ]
  }

  // ATM withdrawal validation
  static validateATMWithdrawal() {
    return [
      body("accountId").isMongoId().withMessage("Account ID must be a valid MongoDB ObjectId"),

      body("amount")
        .isFloat({ min: 20, max: 1000 })
        .withMessage("ATM withdrawal amount must be between $20 and $1,000")
        .custom((value) => {
          if (value % 20 !== 0) {
            throw new Error("ATM withdrawal amount must be in multiples of $20")
          }
          return true
        }),

      body("atmId")
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage("ATM ID is required and must not exceed 50 characters"),

      body("pin")
        .matches(/^\d{4,6}$/)
        .withMessage("PIN must be 4-6 digits"),

      body("location").optional().trim().isLength({ max: 200 }).withMessage("Location must not exceed 200 characters"),

      this.handleValidationErrors,
    ]
  }

  // Payment validation
  static validatePayment() {
    return [
      body("fromAccountId").isMongoId().withMessage("From account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 100000 }).withMessage("Amount must be between $0.01 and $100,000"),

      body("payeeId").optional().isMongoId().withMessage("Payee ID must be a valid MongoDB ObjectId"),

      body("payeeName")
        .trim()
        .isLength({ min: 2, max: 100 })
        .withMessage("Payee name must be between 2 and 100 characters"),

      body("payeeAccountNumber")
        .optional()
        .matches(/^\d{8,17}$/)
        .withMessage("Payee account number must be 8-17 digits"),

      body("description")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("paymentMethod")
        .optional()
        .isIn(["ach", "wire", "check", "online"])
        .withMessage("Payment method must be one of: ach, wire, check, online"),

      this.handleValidationErrors,
    ]
  }

  // Bill payment validation
  static validateBillPayment() {
    return [
      body("fromAccountId").isMongoId().withMessage("From account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 50000 }).withMessage("Amount must be between $0.01 and $50,000"),

      body("billerId").isMongoId().withMessage("Biller ID must be a valid MongoDB ObjectId"),

      body("accountNumber")
        .trim()
        .isLength({ min: 1, max: 50 })
        .withMessage("Account number must be between 1 and 50 characters"),

      body("dueDate").optional().isISO8601().withMessage("Due date must be a valid ISO date"),

      body("memo").optional().trim().isLength({ max: 100 }).withMessage("Memo must not exceed 100 characters"),

      body("autopay").optional().isBoolean().withMessage("Autopay must be true or false"),

      this.handleValidationErrors,
    ]
  }

  // Scheduled transaction validation
  static validateScheduledTransaction() {
    return [
      body("fromAccountId").isMongoId().withMessage("From account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 100000 }).withMessage("Amount must be between $0.01 and $100,000"),

      body("frequency")
        .isIn(["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "annually"])
        .withMessage("Frequency must be one of: once, daily, weekly, biweekly, monthly, quarterly, annually"),

      body("startDate").isISO8601().withMessage("Start date must be a valid ISO date"),

      body("endDate").optional().isISO8601().withMessage("End date must be a valid ISO date"),

      body("description")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("transactionType")
        .isIn(["transfer", "payment", "bill_payment"])
        .withMessage("Transaction type must be one of: transfer, payment, bill_payment"),

      body("maxExecutions")
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage("Max executions must be between 1 and 1000"),

      this.handleValidationErrors,
    ]
  }

  // Scheduled transaction update validation
  static validateScheduledTransactionUpdate() {
    return [
      body("amount")
        .optional()
        .isFloat({ min: 0.01, max: 100000 })
        .withMessage("Amount must be between $0.01 and $100,000"),

      body("frequency")
        .optional()
        .isIn(["once", "daily", "weekly", "biweekly", "monthly", "quarterly", "annually"])
        .withMessage("Frequency must be one of: once, daily, weekly, biweekly, monthly, quarterly, annually"),

      body("endDate").optional().isISO8601().withMessage("End date must be a valid ISO date"),

      body("description")
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("status")
        .optional()
        .isIn(["active", "paused", "cancelled"])
        .withMessage("Status must be one of: active, paused, cancelled"),

      this.handleValidationErrors,
    ]
  }

  // Recurring transaction validation
  static validateRecurringTransaction() {
    return [
      body("fromAccountId").isMongoId().withMessage("From account ID must be a valid MongoDB ObjectId"),

      body("amount").isFloat({ min: 0.01, max: 100000 }).withMessage("Amount must be between $0.01 and $100,000"),

      body("frequency")
        .isIn(["daily", "weekly", "biweekly", "monthly", "quarterly", "annually"])
        .withMessage("Frequency must be one of: daily, weekly, biweekly, monthly, quarterly, annually"),

      body("startDate").isISO8601().withMessage("Start date must be a valid ISO date"),

      body("description")
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("transactionType")
        .isIn(["transfer", "payment", "bill_payment", "savings"])
        .withMessage("Transaction type must be one of: transfer, payment, bill_payment, savings"),

      body("indefinite").optional().isBoolean().withMessage("Indefinite must be true or false"),

      this.handleValidationErrors,
    ]
  }

  // Recurring transaction update validation
  static validateRecurringTransactionUpdate() {
    return [
      body("amount")
        .optional()
        .isFloat({ min: 0.01, max: 100000 })
        .withMessage("Amount must be between $0.01 and $100,000"),

      body("frequency")
        .optional()
        .isIn(["daily", "weekly", "biweekly", "monthly", "quarterly", "annually"])
        .withMessage("Frequency must be one of: daily, weekly, biweekly, monthly, quarterly, annually"),

      body("description")
        .optional()
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage("Description must be between 1 and 200 characters"),

      body("status")
        .optional()
        .isIn(["active", "paused", "cancelled"])
        .withMessage("Status must be one of: active, paused, cancelled"),

      body("indefinite").optional().isBoolean().withMessage("Indefinite must be true or false"),

      this.handleValidationErrors,
    ]
  }

  // Transaction verification validation
  static validateTransactionVerification() {
    return [
      body("verificationCode")
        .matches(/^\d{6}$/)
        .withMessage("Verification code must be 6 digits"),

      body("method")
        .optional()
        .isIn(["sms", "email", "authenticator"])
        .withMessage("Verification method must be one of: sms, email, authenticator"),

      this.handleValidationErrors,
    ]
  }

  // Dispute validation
  static validateDispute() {
    return [
      body("reason")
        .isIn(["unauthorized", "incorrect_amount", "duplicate", "fraud", "service_not_received", "other"])
        .withMessage(
          "Reason must be one of: unauthorized, incorrect_amount, duplicate, fraud, service_not_received, other",
        ),

      body("description")
        .trim()
        .isLength({ min: 10, max: 500 })
        .withMessage("Description must be between 10 and 500 characters"),

      body("amount").optional().isFloat({ min: 0.01 }).withMessage("Disputed amount must be greater than $0.01"),

      body("evidence").optional().isArray().withMessage("Evidence must be an array of file URLs or descriptions"),

      this.handleValidationErrors,
    ]
  }

  // Analytics request validation
  static validateAnalyticsRequest() {
    return [
      query("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO date"),

      query("endDate").optional().isISO8601().withMessage("End date must be a valid ISO date"),

      query("accountId").optional().isMongoId().withMessage("Account ID must be a valid MongoDB ObjectId"),

      query("category")
        .optional()
        .isIn(["food", "transport", "utilities", "entertainment", "healthcare", "shopping", "other"])
        .withMessage("Category must be one of: food, transport, utilities, entertainment, healthcare, shopping, other"),

      query("groupBy")
        .optional()
        .isIn(["day", "week", "month", "year", "category"])
        .withMessage("Group by must be one of: day, week, month, year, category"),

      this.handleValidationErrors,
    ]
  }

  // Admin transaction filters validation
  static validateAdminTransactionFilters() {
    return [
      query("userId").optional().isMongoId().withMessage("User ID must be a valid MongoDB ObjectId"),

      query("accountId").optional().isMongoId().withMessage("Account ID must be a valid MongoDB ObjectId"),

      query("type")
        .optional()
        .isIn(["transfer", "deposit", "withdrawal", "payment", "bill_payment", "atm", "check"])
        .withMessage("Type must be one of: transfer, deposit, withdrawal, payment, bill_payment, atm, check"),

      query("status")
        .optional()
        .isIn(["pending", "completed", "failed", "cancelled", "processing", "flagged"])
        .withMessage("Status must be one of: pending, completed, failed, cancelled, processing, flagged"),

      query("minAmount").optional().isFloat({ min: 0 }).withMessage("Minimum amount must be a positive number"),

      query("maxAmount").optional().isFloat({ min: 0 }).withMessage("Maximum amount must be a positive number"),

      query("flagged").optional().isBoolean().withMessage("Flagged must be true or false"),

      query("suspicious").optional().isBoolean().withMessage("Suspicious must be true or false"),

      this.handleValidationErrors,
    ]
  }

  // Admin status update validation
  static validateAdminStatusUpdate() {
    return [
      body("status")
        .isIn(["pending", "completed", "failed", "cancelled", "processing", "flagged", "approved", "rejected"])
        .withMessage(
          "Status must be one of: pending, completed, failed, cancelled, processing, flagged, approved, rejected",
        ),

      body("reason").trim().isLength({ min: 5, max: 200 }).withMessage("Reason must be between 5 and 200 characters"),

      body("adminNotes")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage("Admin notes must not exceed 500 characters"),

      this.handleValidationErrors,
    ]
  }

  // Transaction flag validation
  static validateTransactionFlag() {
    return [
      body("flagType")
        .isIn(["suspicious", "fraud", "compliance", "manual_review", "high_risk"])
        .withMessage("Flag type must be one of: suspicious, fraud, compliance, manual_review, high_risk"),

      body("reason").trim().isLength({ min: 5, max: 200 }).withMessage("Reason must be between 5 and 200 characters"),

      body("severity")
        .optional()
        .isIn(["low", "medium", "high", "critical"])
        .withMessage("Severity must be one of: low, medium, high, critical"),

      body("requiresAction").optional().isBoolean().withMessage("Requires action must be true or false"),

      this.handleValidationErrors,
    ]
  }
}
