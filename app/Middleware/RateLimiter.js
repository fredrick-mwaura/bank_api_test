import rateLimit from 'express-rate-limit'
import logger from '../utils/logger.js'

const createLimiter = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      status: 'error',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: req.originalUrl
      });

      res.status(429).json({
        status: 'error',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limiters for different endpoints (Laravel-style throttling groups)
export const rateLimiters = {
  // Global rate limiter
  global: createLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests per window
    'Too many requests from this IP, please try again later.'
  ),

  // Authentication rate limiter (stricter)
  auth: createLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts per window
    'Too many authentication attempts, please try again later.',
    true // Skip successful requests
  ),

  // Transaction rate limiter
  transaction: createLimiter(
    1 * 60 * 1000, // 1 minute
    10, // 10 transactions per minute
    'Too many transaction requests, please slow down.'
  ),

  // Password reset rate limiter
  passwordReset: createLimiter(
    60 * 60 * 1000, // 1 hour
    3,
    'Too many password reset attempts, please try again later.'
  )
};
