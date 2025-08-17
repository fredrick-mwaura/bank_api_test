import express from "express"
import * as userController from "../app/controllers/userController.js"
import {ValidationMiddleware} from "../app/Middleware/Validation.js"
import AuthMiddleware from "../app/Middleware/AuthMiddleware.js"

const router = express.Router()

// All user routes require authentication
router.use(AuthMiddleware.authenticate)

// User profile routes
router.get("/profile", userController.getProfile)
router.put("/profile", ValidationMiddleware.validateProfileUpdate(), userController.updateProfile)

// User preferences
// router.get("/preferences", userController.getPreferences)
// router.put("/preferences", ValidationMiddleware.validatePreferences(), userController.updatePreferences)

// User notifications
router.get(
  "/notifications",
  ValidationMiddleware.validatePagination(),
  // ValidationMiddleware.validateNotificationFilters(),
  userController.getNotifications,
)

router.put(
  "/notifications/:id/read",
  ValidationMiddleware.validateObjectId("id"),
  userController.markNotificationAsRead,
)

router.put("/notifications/read-all", userController.markAllNotificationsAsRead)

// User activity logs
router.get("/activity", ValidationMiddleware.validatePagination(), userController.getActivityLog)

// Admin only routes - Apply admin authorization middleware
// router.use(AuthMiddleware.authorize("admin"))

// Admin user management
router.get(
  "/",
  ValidationMiddleware.validatePagination(),
  // ValidationMiddleware.validateUserFilters(),
  userController.getAllUsers,
)

router.get("/:id", ValidationMiddleware.validateObjectId("id"), userController.getUserById)

router.put(
  "/:id/status",
  ValidationMiddleware.validateObjectId("id"),
  // ValidationMiddleware.validateStatusUpdate(),
  userController.updateUserStatus,
)

router.delete("/:id", ValidationMiddleware.validateObjectId("id"), userController.deleteUser)

// User statistics (admin only)
router.get("/stats/overview", userController.getUserStats)
router.get("/stats/registrations", userController.getRegistrationStats)

export default router
