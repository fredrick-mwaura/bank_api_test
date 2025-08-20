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


/**
 * @param {number} windowMs - Time window in ms
 * @param {number} max - Max number of requests
 * @param {string} message - Error message
 * @param {boolean} skipSuccessfulRequests - Skip counting successful requests
 */
export const rateLimiters = {
  global: createLimiter(15 * 60 * 1000, 100, 'Too many requests from this IP, please try again later.'),
  auth: createLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts, please try again later.', false),
  transaction: createLimiter(1 * 60 * 1000, 10, 'Too many transaction requests, please slow down.'),
  passwordReset: createLimiter(60 * 60 * 1000, 3, 'Too many password reset attempts, please try again later.'),
};
