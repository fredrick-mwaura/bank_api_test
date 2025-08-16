import { body, param, query, validationResult } from 'express-validator'

// Laravel-style validation middleware
export class ValidationMiddleware {
  // Handle validation results (Laravel-style validation response)
  static handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const formattedErrors = {};
      
      errors.array().forEach(error => {
        if (!formattedErrors[error.path]) {
          formattedErrors[error.path] = [];
        }
        formattedErrors[error.path].push(error.msg);
      });

      return res.status(422).json({
        status: 'error',
        message: 'Validation failed',
        errors: formattedErrors
      });
    }
    
    next();
  }

  // User registration validation rules
  static validateRegistration() {
    return [
      body('firstName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('First name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('First name can only contain letters and spaces'),
      
      body('lastName')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Last name must be between 2 and 50 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Last name can only contain letters and spaces'),
      
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
      
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
      
      body('phoneNumber')
        .isMobilePhone()
        .withMessage('Please provide a valid phone number'),
      
      body('dateOfBirth')
        .isISO8601()
        .withMessage('Please provide a valid date of birth')
        .custom((value) => {
          const age = new Date().getFullYear() - new Date(value).getFullYear();
          if (age < 18) {
            throw new Error('You must be at least 18 years old');
          }
          return true;
        }),
      
      body('ssn')
        .matches(/^\d{3}-\d{2}-\d{4}$/)
        .withMessage('SSN must be in format XXX-XX-XXXX'),

      this.handleValidationErrors
    ];
  }

  // Login validation rules
  static validateLogin() {
    return [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
      
      body('password')
        .notEmpty()
        .withMessage('Password is required'),

      this.handleValidationErrors
    ];
  }

  // Transaction validation rules
  static validateTransaction() {
    return [
      body('amount')
        .isFloat({ min: 0.01, max: 1000000 })
        .withMessage('Amount must be between $0.01 and $1,000,000'),
      
      body('description')
        .trim()
        .isLength({ min: 1, max: 200 })
        .withMessage('Description must be between 1 and 200 characters'),
      
      body('toAccount')
        .optional()
        .isMongoId()
        .withMessage('Invalid account ID format'),
      
      body('category')
        .optional()
        .isIn(['food', 'transport', 'utilities', 'entertainment', 'healthcare', 'shopping', 'other'])
        .withMessage('Invalid transaction category'),

      this.handleValidationErrors
    ];
  }

  // Account creation validation
  static validateAccountCreation() {
    return [
      body('accountType')
        .isIn(['checking', 'savings', 'business'])
        .withMessage('Account type must be checking, savings, or business'),
      
      body('initialDeposit')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Initial deposit must be a positive number'),

      this.handleValidationErrors
    ];
  }

  // Password reset validation
  static validatePasswordReset() {
    return [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

      this.handleValidationErrors
    ];
  }

  // New password validation
  static validateNewPassword() {
    return [
      body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
      
      body('confirmPassword')
        .custom((value, { req }) => {
          if (value !== req.body.password) {
            throw new Error('Password confirmation does not match password');
          }
          return true;
        }),

      this.handleValidationErrors
    ];
  }

  // MongoDB ObjectId validation
  static validateObjectId(paramName = 'id') {
    return [
      param(paramName)
        .isMongoId()
        .withMessage(`Invalid ${paramName} format`),

      this.handleValidationErrors
    ];
  }

  // Pagination validation
  static validatePagination() {
    return [
      query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),

      this.handleValidationErrors
    ];
  }
}
