import express from 'express'
import * as authController from '../app/controllers/authController.js'
import * as AuthMiddleware from '../app/Middleware/Auth.js'
import {ValidationMiddleware} from '../app/Middleware/Validation.js'
import * as rateLimiters from '../app/Middleware/RateLimiter.js'


const router = express.Router();

// Laravel-style route grouping for authentication

// Public routes (no authentication required)
router.post('/register',
  rateLimiters.auth,
  ValidationMiddleware.validateRegistration(),
  authController.register()
);

router.get('/register', (req, res) => {
  res.render('Auth/Register'); // Render registration page
});

router.post('/login', 
  rateLimiters.auth,
  ValidationMiddleware.validateLogin(),
  authController.login
);

router.post('/forgot-password', 
  rateLimiters.passwordReset,
  ValidationMiddleware.validatePasswordReset(),
  authController.forgotPassword
);

router.post('/reset-password', 
  rateLimiters.passwordReset,
  ValidationMiddleware.validateNewPassword(),
  authController.resetPassword
);

router.post('/verify-email', 
  ValidationMiddleware.validateObjectId('token'),
  userController.verifyEmail
);

router.post('/resend-verification', 
  rateLimiters.auth,
  ValidationMiddleware.validatePasswordReset(), // Reuse email validation
  userController.resendVerification
);

// Protected routes (authentication required)
router.use(AuthMiddleware.authenticate); // Apply auth middleware to all routes below

// router.post('/refresh-token', authController.refreshToken());
// router.post('/logout', authController.logout());
router.get('/me', authController.getProfile());
router.put('/me', 
  ValidationMiddleware.validateProfileUpdate(),
  authController.updateProfile
);

router.post('/change-password', 
  ValidationMiddleware.validatePasswordChange(),
  authController.changePassword
);

// router.post('/enable-2fa', authController.enableTwoFactor);
// router.post('/disable-2fa', authController.disableTwoFactor);
// router.post('/verify-2fa', authController.verifyTwoFactor);

// Security routes
router.get('/sessions', authController.getActiveSessions());
router.delete('/sessions/:sessionId', 
  ValidationMiddleware.validateObjectId('sessionId'),
  authController.terminateSession
);

export default router;
