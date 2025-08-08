import express from 'express';
import adminController from '../app/controllers/adminController.js';
import * as AuthMiddleware from '../app/middleware/Auth.js';
import * as ValidationMiddleware from '../app/middleware/Validation.js';

const router = express.Router()

// All admin routes require admin authentication
router.use(AuthMiddleware.authenticate);
router.use(AuthMiddleware.authorize('admin'));

// Dashboard and overview
router.get('/dashboard', adminController.getDashboard);
router.get('/stats/overview', adminController.getOverviewStats);

// User management
router.get('/users', 
  ValidationMiddleware.validatePagination(),
  ValidationMiddleware.validateUserFilters(),
  adminController.getUsers
);

router.get('/users/:id', 
  ValidationMiddleware.validateObjectId('id'),
  adminController.getUser
);

router.put('/users/:id/status', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateStatusUpdate(),
  adminController.updateUserStatus
);

router.post('/users/:id/impersonate', 
  ValidationMiddleware.validateObjectId('id'),
  adminController.impersonateUser
);

// Account management
router.get('/accounts', 
  ValidationMiddleware.validatePagination(),
  ValidationMiddleware.validateAccountFilters(),
  adminController.getAccounts
);

router.put('/accounts/:id/status', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateAdminStatusUpdate(),
  adminController.updateAccountStatus
);

// Transaction monitoring
router.get('/transactions/suspicious', 
  ValidationMiddleware.validatePagination(),
  adminController.getSuspiciousTransactions
);

router.get('/transactions/flagged', 
  ValidationMiddleware.validatePagination(),
  adminController.getFlaggedTransactions
);

router.post('/transactions/:id/investigate', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateInvestigation(),
  adminController.investigateTransaction
);

// System management
router.get('/system/health', adminController.getSystemHealth);
router.get('/system/logs', 
  ValidationMiddleware.validateLogRequest(),
  adminController.getSystemLogs
);

router.post('/system/maintenance', 
  ValidationMiddleware.validateMaintenanceRequest(),
  adminController.setMaintenanceMode
);

// Configuration management
router.get('/config', adminController.getConfiguration);
router.put('/config', 
  ValidationMiddleware.validateConfigUpdate(),
  adminController.updateConfiguration
);

// Audit logs
router.get('/audit', 
  ValidationMiddleware.validatePagination(),
  ValidationMiddleware.validateAuditFilters(),
  adminController.getAuditLogs
);

export default router;
