import bcrypt from "bcryptjs"
import crypto from "crypto"
import User from "../Models/User.js"
import RefreshToken from "../Models/refreshToken.js"
import * as auditService from "../Services/AuditService.js"
import * as emailService from "../Services/EmailService.js"
import logger from "../utils/logger.js"
import {config} from "../../config/index.js"
import { generateTokens, verifyRefreshToken } from "../utils/tokenUtils.js"
import { encrypt } from "../helpers/encryption.js"

// Laravel-style authentication controller
class AuthController {
  // User registration
  async register(req, res) {
    try {
      console.log('allllo', req.body)
      const { firstName, lastName, email, password, confirm_password, phoneNumber, dateOfBirth, snn } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ email }, { phoneNumber }],
      })

      if (existingUser) {
        return res.status(409).json({
          status: "error",
          message:
            existingUser.email === email ? "Email address is already registered" : "Phone number is already registered",
        })
      }

      if(password !== confirm_password){
        return res.status(400).json({
          success: false,
          message: "password do not match!"
        })
      }

      // Hash password with higher rounds for banking security
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds)

      // Encrypt sensitive data (snn)
      const encryptedsnn = encrypt(snn)

      // Generate email verification token
      const emailVerificationToken = crypto.randomBytes(32).toString("hex")
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      // Create user
      const user = new User({
        firstName,
        lastName,
        email: email.toLowerCase(),
        password: hashedPassword,
        phoneNumber,
        dateOfBirth: new Date(dateOfBirth),
        snn: encryptedsnn,
        emailVerificationToken,
        emailVerificationExpires,
        status: "inactive", // Require email verification
        role: "customer",
      })

      await user.save()

      // Send verification email
      await emailService.sendVerificationEmail(user.email, emailVerificationToken)

      // Log registration attempt
      await auditService.logActivity({
        userId: user._id,
        action: "user_registered",
        resource: "user",
        resourceId: user._id,
        metadata: {
          email: user.email,
          registrationMethod: "email",
        },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      logger.info("User registered successfully", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
      })

      res.status(201).json({
        status: "success",
        message: "Registration successful. Please check your email to verify your account.",
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            isEmailVerified: user.isEmailVerified,
          },
        },
      })
    } catch (error) {
      logger.error("Registration error:", error)
      res.status(500).json({
        status: "error",
        message: "Registration failed. Please try again." + error,
      })
    }
  }

  // User login
  async login(req, res) {
    try {
      const { email, password, rememberMe = false } = req.body
      const ipAddress = req.ip
      const userAgent = req.get("User-Agent")

      // Find user by email
      const user = await User.findOne({
        email: email.toLowerCase(),
      }).select("+password +loginAttempts +lockUntil")
      // User.find().then(users => {
      //   console.log(users);
      // });

      if (!user) {
        await auditService.logActivity({
          action: "login_failed",
          resource: "auth",
          metadata: {
            email,
            reason: "user_not_found",
          },
          ipAddress,
          userAgent,
        })

        return res.status(401).json({
          status: "401",
          message: "Invalid email or password",
        })
      }

      // Check if account is locked
      if (user.isLocked) {
        await auditService.logActivity({
          userId: user._id,
          action: "login_failed",
          resource: "auth",
          metadata: {
            email,
            reason: "account_locked",
          },
          ipAddress,
          userAgent,
        })

        return res.status(423).json({
          status: "error",
          message: "Account is temporarily locked due to too many failed login attempts",
        })
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password)

      if (!isPasswordValid) {
        // Increment login attempts
        // await user.incLoginAttempts()

        await auditService.logActivity({
          userId: user._id,
          action: "login_failed",
          resource: "auth",
          metadata: {
            email,
            reason: "invalid_password",
            attempts: user.loginAttempts + 1,
          },
          ipAddress,
          userAgent,
        })

        return res.status(401).json({
          status: "error",
          message: "Invalid email or password",
        })
      }

      // Check account status
      if (user.status !== "active") {
        return res.status(403).json({
          status: "error",
          message:
            user.status === "inactive"
              ? "Please verify your email address to activate your account"
              : "Your account has been suspended. Please contact support.",
        })
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts()
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user, rememberMe)

      // Save refresh token
      await RefreshToken.create({
        token: refreshToken,
        userId: user._id,
        expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000),
        ipAddress,
        userAgent,
      })

      // Update last login
      user.lastLoginAt = new Date()
      user.lastLoginIP = ipAddress
      await user.save()

      // Log successful login
      await auditService.logActivity({
        userId: user._id,
        action: "login_successful",
        resource: "auth",
        metadata: {
          email: user.email,
          rememberMe,
        },
        ipAddress,
        userAgent,
      })

      logger.info("User logged in successfully", {
        userId: user._id,
        email: user.email,
        ip: ipAddress,
      })

      res.status(200).json({
        status: "success",
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            twoFactorEnabled: user.twoFactorEnabled,
            lastLoginAt: user.lastLoginAt,
          },
          tokens: {
            accessToken,
            refreshToken,
            expiresIn: config.jwt.expiresIn,
          },
        },
      })
    } catch (error) {
      logger.error("Login error:", error)
      res.status(500).json({
        status: "error",
        message: "Login failed. Please try again." + error,
      })
    }
  }

  // Refresh access token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body

      if (!refreshToken) {
        return res.status(401).json({
          status: "error",
          message: "Refresh token is required",
        })
      }

      // Verify and decode refresh token
      const decoded = verifyRefreshToken(refreshToken)

      // Find refresh token in database
      const tokenDoc = await RefreshToken.findOne({
        token: refreshToken,
        userId: decoded.id,
        expiresAt: { $gt: new Date() },
      }).populate("userId")

      if (!tokenDoc) {
        return res.status(401).json({
          status: "error",
          message: "Invalid or expired refresh token",
        })
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(tokenDoc.userId)

      // Update refresh token
      tokenDoc.token = newRefreshToken
      tokenDoc.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await tokenDoc.save()

      res.status(200).json({
        status: "success",
        data: {
          tokens: {
            accessToken,
            refreshToken: newRefreshToken,
            expiresIn: config.jwt.expiresIn,
          },
        },
      })
    } catch (error) {
      logger.error("Token refresh error:", error)
      res.status(401).json({
        status: "error",
        message: "Invalid refresh token",
      })
    }
  }

  // User logout
  async logout(req, res) {
    try {
      const { refreshToken } = req.body
      const userId = req.user._id

      // Remove refresh token
      if (refreshToken) {
        await RefreshToken.deleteOne({ token: refreshToken, userId })
      }

      // Log logout
      await auditService.logActivity({
        userId,
        action: "logout",
        resource: "auth",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "Logged out successfully",
      })
    } catch (error) {
      logger.error("Logout error:", error)
      res.status(500).json({
        status: "error",
        message: "Logout failed",
      })
    }
  }

  // Logout from all devices
  async logoutAll(req, res) {
    try {
      const userId = req.user._id

      // Remove all refresh tokens for user
      await RefreshToken.deleteMany({ userId })

      // Log logout from all devices
      await auditService.logActivity({
        userId,
        action: "logout_all_devices",
        resource: "auth",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "Logged out from all devices successfully",
      })
    } catch (error) {
      logger.error("Logout all error:", error)
      res.status(500).json({
        status: "error",
        message: "Logout failed",
      })
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body

      const user = await User.findOne({ email: email.toLowerCase() })

      // Always return success to prevent email enumeration
      const successResponse = {
        status: "success",
        message: "If an account with that email exists, you will receive a password reset link.",
      }

      if (!user) {
        // Log failed attempt
        await auditService.logActivity({
          action: "password_reset_failed",
          resource: "auth",
          metadata: {
            email,
            reason: "user_not_found",
          },
          ipAddress: req.ip,
          userAgent: req.get("User-Agent"),
        })

        return res.status(200).json(successResponse)
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString("hex")
      const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      // Save reset token
      user.passwordResetToken = resetToken
      user.passwordResetExpires = resetTokenExpires
      await user.save()

      // Send reset email
      await emailService.sendPasswordResetEmail(user.email, resetToken)

      // Log password reset request
      await auditService.logActivity({
        userId: user._id,
        action: "password_reset_requested",
        resource: "auth",
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json(successResponse)
    } catch (error) {
      logger.error("Forgot password error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to process password reset request",
      })
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body

      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() },
      })

      if (!user) {
        return res.status(400).json({
          status: "error",
          message: "Invalid or expired reset token",
        })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds)

      // Update password and clear reset token
      user.password = hashedPassword
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      user.passwordChangedAt = new Date()
      await user.save()

      // Invalidate all refresh tokens
      await RefreshToken.deleteMany({ userId: user._id })

      // Log password reset
      await auditService.logActivity({
        userId: user._id,
        action: "password_reset_completed",
        resource: "auth",
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      // Send confirmation email
      await emailService.sendPasswordResetConfirmation(user.email)

      res.status(200).json({
        status: "success",
        message: "Password reset successfully. Please log in with your new password.",
      })
    } catch (error) {
      logger.error("Reset password error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to reset password",
      })
    }
  }

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { token } = req.params
      console.log('token', token)
      if(!token){
        return res.render('Avuth/verify.ejs', {
          title: 'no token provided',
          message: 'no token provided'
        })
      }

      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() },
      })

      if (!user) {
        return res.status(400).render("Auth/verify.ejs", {
          title: "Verify Email",
          message: "Invalid or expired verification token."
        });
      }


      // Activate user account
      user.isEmailVerified = true
      user.status = "active"
      user.emailVerificationToken = undefined
      user.emailVerificationExpires = undefined
      user.emailVerifiedAt = new Date()
      await user.save()

      // Log email verification
      await auditService.logActivity({
        userId: user._id,
        action: "email_verified",
        resource: "user",
        metadata: { email: user.email },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      // Send welcome email
      await emailService.sendWelcomeEmail(user.email, user.firstName)

      return res.render("Auth/verify.ejs", {
        title: "Verify Email",
        message: "Your email has been verified successfully!"
      });
    } catch (error) {
      logger.error("Email verification error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to verify email",
      })
    }
  }

  // Resend verification email
  async resendVerification(req, res) {
    try {
      const { email } = req.body

      const user = await User.findOne({ email: email.toLowerCase() })

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
        })
      }

      if (user.isEmailVerified) {
        return res.status(400).json({
          status: "error",
          message: "Email is already verified",
        })
      }

      // Generate new verification token
      const emailVerificationToken = crypto.randomBytes(32).toString("hex")
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      user.emailVerificationToken = emailVerificationToken
      user.emailVerificationExpires = emailVerificationExpires
      await user.save()

      // Send verification email
      await emailService.sendVerificationEmail(user.email, emailVerificationToken)

      res.status(200).json({
        status: "success",
        message: "Verification email sent successfully",
      })
    } catch (error) {
      logger.error("Resend verification error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to resend verification email",
      })
    }
  }

  // Get user profile
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user._id).select("-password")

      res.status(200).json({
        status: "success",
        data: { user },
      })
    } catch (error) {
      logger.error("Get profile error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch profile",
      })
    }
  }

  // Update profile
  async updateProfile(req, res) {
    try {
      const userId = req.user._id
      const updates = req.body

      delete updates.password
      delete updates.email
      delete updates.role
      delete updates.status

      const user = await User.findByIdAndUpdate(userId, updates, {
        new: true,
        runValidators: true,
      }).select("-password")

      await auditService.logActivity({
        userId,
        action: "profile_updated",
        resource: "user",
        resourceId: userId,
        metadata: { updatedFields: Object.keys(updates) },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "Profile updated successfully",
        data: { user },
      })
    } catch (error) {
      logger.error("Update profile error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to update profile",
      })
    }
  }

  // Change password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body
      const userId = req.user._id

      const user = await User.findById(userId).select("+password")

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          status: "error",
          message: "Current password is incorrect",
        })
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds)

      // Update password
      user.password = hashedPassword
      user.passwordChangedAt = new Date()
      await user.save()

      // Invalidate all refresh tokens except current session
      await RefreshToken.deleteMany({
        userId,
        _id: { $ne: req.refreshTokenId }, // Keep current session active
      })

      // Log password change
      await auditService.logActivity({
        userId,
        action: "password_changed",
        resource: "auth",
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "Password changed successfully",
      })
    } catch (error) {
      logger.error("Change password error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to change password",
      })
    }
  }

  async enableTwoFactor(req, res) {
    try {
      // Implementation for 2FA setup
      res.status(501).json({
        status: "error",
        message: "Two-factor authentication not implemented yet",
      })
    } catch (error) {
      logger.error("Enable 2FA error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to enable two-factor authentication",
      })
    }
  }

  // Disable two-factor authentication
  async disableTwoFactor(req, res) {
    try {
      // Implementation for 2FA disable
      res.status(501).json({
        status: "error",
        message: "Two-factor authentication not implemented yet",
      })
    } catch (error) {
      logger.error("Disable 2FA error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to disable two-factor authentication",
      })
    }
  }

  // Verify two-factor authentication
  async verifyTwoFactor(req, res) {
    try {
      // Implementation for 2FA verification
      res.status(501).json({
        status: "error",
        message: "Two-factor authentication not implemented yet",
      })
    } catch (error) {
      logger.error("Verify 2FA error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to verify two-factor authentication",
      })
    }
  }

  // Get active sessions
  async getActiveSessions(req, res) {
    try {
      const userId = req.user._id

      const sessions = await RefreshToken.getUserSessions(userId)

      res.status(200).json({
        status: "success",
        data: { sessions },
      })
    } catch (error) {
      logger.error("Get active sessions error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to fetch active sessions",
      })
    }
  }

  // Terminate session
  async terminateSession(req, res) {
    try {
      const { sessionId } = req.params
      const userId = req.user._id

      const result = await RefreshToken.deleteOne({
        sessionId,
        userId,
      })

      if (result.deletedCount === 0) {
        return res.status(404).json({
          status: "error",
          message: "Session not found",
        })
      }

      // Log session termination
      await auditService.logActivity({
        userId,
        action: "session_terminated",
        resource: "auth",
        metadata: { sessionId },
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      })

      res.status(200).json({
        status: "success",
        message: "Session terminated successfully",
      })
    } catch (error) {
      logger.error("Terminate session error:", error)
      res.status(500).json({
        status: "error",
        message: "Failed to terminate session",
      })
    }
  }
}

// Create and export controller instance
const authController = new AuthController()

export default authController
