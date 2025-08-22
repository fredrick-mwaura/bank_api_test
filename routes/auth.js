import express from "express"
import authController from "../app/controllers/authController.js"
import AuthMiddleware from "../app/Middleware/AuthMiddleware.js"
import {ValidationMiddleware} from "../app/Middleware/Validation.js"
import {rateLimiters} from "../app/Middleware/RateLimiter.js"

const router = express.Router()

// Laravel-style route grouping for authentication
router.get("/register", (req, res) => {
  res.render("Auth/Register.ejs", {
    title: "register", 
    message: "welcome buddy!"
  })
})

router.get('/login', (req, res)=>{
  res.render("Auth/Login.ejs",{
    title: "login",
    message: "login to access account info"
  })
})

router.get(
  '/verify-email/:token',
  // ValidationMiddleware.validateObjectId("token"),
  authController.verifyEmail
)
// Public routes (no authentication required)
router.post("/register", authController.register) // ValidationMiddleware.validateRegistration(),

router.post("/login", 
  // rateLimiters.auth, 
  // ValidationMiddleware.validateLogin(), 
  authController.login)

router.post(
  "/forgot-password",
  rateLimiters.passwordReset,
  ValidationMiddleware.validatePasswordReset(),
  authController.forgotPassword,
)

router.post(
  "/reset-password",
  rateLimiters.passwordReset,
  ValidationMiddleware.validateNewPassword(),
  authController.resetPassword,
)

router.post(
  "/resend-verification",
  rateLimiters.auth,
  ValidationMiddleware.validatePasswordReset(), // Reuse email validation
  authController.resendVerification,
)

// Protected routes (authentication required)
router.use(AuthMiddleware.authenticate) // Apply auth middleware to all routes below

router.post("/refresh-token", authController.refreshToken)
router.post("/logout", authController.logout)
router.post("/logout-all", authController.logoutAll) // Logout from all devices
router.get("/profile", authController.getProfile)
router.put("/profile", ValidationMiddleware.validateProfileUpdate(), authController.updateProfile)

router.post("/change-password", ValidationMiddleware.validatePasswordChange(), authController.changePassword)

router.post("/enable-2fa", authController.enableTwoFactor)
router.post("/disable-2fa", authController.disableTwoFactor)
router.post("/verify-2fa", authController.verifyTwoFactor)

// Security routes
router.get("/sessions", authController.getActiveSessions)
router.delete(
  "/sessions/:sessionId",
  ValidationMiddleware.validateObjectId("sessionId"),
  authController.terminateSession,
)

export default router
