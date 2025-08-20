import databaseConfig from './database.js'
import dotenv from 'dotenv'

dotenv.config();


export const config = {
  app: {
    name: process.env.APP_NAME,
    env: process.env.NODE_ENV,
    debug: process.env.APP_DEBUG,
    url: process.env.APP_URL,
    port: parseInt(process.env.PORT),
    timezone: process.env.TIMEZONE
  },
  database: databaseConfig,

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    issuer: process.env.JWT_ISSUER,
    audience: process.env.JWT_AUDIENCE
  },
  mail: {
    driver: process.env.MAIL_DRIVER,
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMPT_PORT),
    username: process.env.SMPT_USER,
    password: process.env.SMTP_PASS,
    encryption: process.env.MAIL_ENCRYPTION || 'tls',
    from: {
      address: process.env.FROM_EMAIL || 'noreply@bankingapi.com',
      name: process.env.FROM_NAME || 'Banking API'
    }
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 15 * 60 * 1000,
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 30 * 60 * 1000
  },

  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
  },
  // Banking business rules
  banking: {
    minAccountBalance: parseFloat(process.env.MIN_ACCOUNT_BALANCE) || 0,
    maxDailyTransactionLimit: parseFloat(process.env.MAX_DAILY_TRANSACTION_LIMIT) || 100000,
    maxMonthlyTransactionLimit: parseFloat(process.env.MAX_MONTHLY_TRANSACTION_LIMIT) || 3000000,
    maxTransactionAmount: parseFloat(process.env.MAX_TRANSACTION_AMOUNT) || 100000,
    minTransactionAmount: parseFloat(process.env.MIN_TRANSACTION_AMOUNT) || 0.01,
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'USD',
    supportedCurrencies: (process.env.SUPPORTED_CURRENCIES || 'KES,USD,EUR,GBP').split(','),
    transactionFee: parseFloat(process.env.TRANSACTION_FEE) || 0,
    overdraftLimit: parseFloat(process.env.OVERDRAFT_LIMIT) || 0
  },
  // File upload configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,application/pdf').split(','),
    uploadPath: process.env.UPLOAD_PATH || '/uploads',
    tempPath: process.env.TEMP_PATH || './temp'
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD'
  },

  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count']
  },

  // Cache configuration (if using Redis)
  cache: {
    driver: process.env.CACHE_DRIVER || 'memory',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    database: parseInt(process.env.REDIS_DB) || 0,
    ttl: parseInt(process.env.CACHE_TTL) || 3600 // 1 hour
  }
};
// console.log("JWT_SECRET from env:", config.jwt.secret);

// console.log(config.app.name, config.jwt.refreshSecret)

// Validate required configuration
const validateConfig = () => {
  const required = [
    'JWT_SECRET',
    'MONGODB_URI'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate JWT secret length
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 64) {
    throw new Error('JWT_SECRET must be at least 64 characters long');
  }

  // Validate encryption key length
  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 characters long');
  }
};

// Only validate in non-test environments
if (process.env.NODE_ENV !== 'test') {
  validateConfig();
}