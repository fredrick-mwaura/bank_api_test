import express  from 'express'
import * as accountController from '../app/controllers/accountController.js'
import * as AuthMiddleware from '../app/Middleware/Auth.js'
import {ValidationMiddleware} from '../app/Middleware/Validation.js';

const router = express.Router();


// All account routes require authentication
router.use(AuthMiddleware.authenticate);

// Account management routes
router.get('/', 
  ValidationMiddleware.validatePagination(),
  accountController.getAccounts
);

router.post('/', 
  ValidationMiddleware.validateAccountCreation(),
  accountController.createAccount
);

router.get('/:id', 
  ValidationMiddleware.validateObjectId('id'),
  AuthMiddleware.verifyAccountOwnership,
  accountController.getAccount
);

router.put('/:id', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateAccountUpdate(),
  AuthMiddleware.verifyAccountOwnership,
  accountController.updateAccount
);

router.delete('/:id', 
  ValidationMiddleware.validateObjectId('id'),
  AuthMiddleware.verifyAccountOwnership,
  accountController.closeAccount
);

// Account balance and statements
router.get('/:id/balance', 
  ValidationMiddleware.validateObjectId('id'),
  AuthMiddleware.verifyAccountOwnership,
  accountController.getBalance
);

router.get('/:id/statement', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateStatementRequest(),
  AuthMiddleware.verifyAccountOwnership,
  accountController.getStatement
);

router.get('/:id/statement/download', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateStatementRequest(),
  AuthMiddleware.verifyAccountOwnership,
  accountController.downloadStatement
);

// Account limits and settings
router.get('/:id/limits', 
  ValidationMiddleware.validateObjectId('id'),
  AuthMiddleware.verifyAccountOwnership,
  accountController.getAccountLimits
);

router.put('/:id/limits', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateLimitsUpdate(),
  AuthMiddleware.verifyAccountOwnership,
  accountController.updateAccountLimits
);

// Account status management
router.put('/:id/freeze', 
  ValidationMiddleware.validateObjectId('id'),
  AuthMiddleware.verifyAccountOwnership,
  accountController.freezeAccount
);

router.put('/:id/unfreeze', 
  ValidationMiddleware.validateObjectId('id'),
  AuthMiddleware.verifyAccountOwnership,
  accountController.unfreezeAccount
);

// Account verification (for business accounts)
router.post('/:id/verify', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateAccountVerification(),
  AuthMiddleware.verifyAccountOwnership,
  accountController.requestAccountVerification
);

// Admin only routes
router.use(AuthMiddleware.authorize('admin'));

router.get('/admin/all', 
  ValidationMiddleware.validatePagination(),
  ValidationMiddleware.validateAccountFilters(),
  accountController.getAllAccounts
);

router.put('/:id/admin/status', 
  ValidationMiddleware.validateObjectId('id'),
  ValidationMiddleware.validateAdminStatusUpdate(),
  accountController.updateAccountStatusAdmin
);

router.get('/admin/stats', accountController.getAccountStats);

export default router;
