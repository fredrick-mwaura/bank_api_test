
// import express from 'express'
// import transactionController from '../controllers/TransactionController.js'
// import AuthMiddleware from '../middleware/Auth.js'
// import ValidationMiddleware from '../middleware/Validation.js'
// import rateLimiters from '../middleware/RateLimiter.js'

// const router = express.Router();


// // All transaction routes require authentication
// router.use(AuthMiddleware.authenticate);

// // Transaction history and details
// router.get('/', 
//   ValidationMiddleware.validatePagination(),
//   ValidationMiddleware.validateTransactionFilters(),
//   transactionController.getTransactions
// );

// router.get('/:id', 
//   ValidationMiddleware.validateObjectId('id'),
//   transactionController.getTransaction
// );

// // Money transfer operations
// router.post('/transfer', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateTransfer(),
//   transactionController.transfer
// );

// router.post('/internal-transfer', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateInternalTransfer(),
//   transactionController.internalTransfer
// );

// router.post('/external-transfer', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateExternalTransfer(),
//   transactionController.externalTransfer
// );

// // Deposit operations
// router.post('/deposit', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateDeposit(),
//   transactionController.deposit
// );

// router.post('/deposit/check', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateCheckDeposit(),
//   transactionController.depositCheck
// );

// // Withdrawal operations
// router.post('/withdrawal', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateWithdrawal(),
//   transactionController.withdrawal
// );

// router.post('/atm-withdrawal', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateATMWithdrawal(),
//   transactionController.atmWithdrawal
// );

// // Payment operations
// router.post('/payment', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validatePayment(),
//   transactionController.makePayment
// );

// router.post('/bill-payment', 
//   rateLimiters.transaction,
//   ValidationMiddleware.validateBillPayment(),
//   transactionController.payBill
// );

// // Scheduled transactions
// router.get('/scheduled', 
//   ValidationMiddleware.validatePagination(),
//   transactionController.getScheduledTransactions
// );

// router.post('/schedule', 
//   ValidationMiddleware.validateScheduledTransaction(),
//   transactionController.scheduleTransaction
// );

// router.put('/scheduled/:id', 
//   ValidationMiddleware.validateObjectId('id'),
//   ValidationMiddleware.validateScheduledTransactionUpdate(),
//   transactionController.updateScheduledTransaction
// );

// router.delete('/scheduled/:id', 
//   ValidationMiddleware.validateObjectId('id'),
//   transactionController.cancelScheduledTransaction
// );

// // Recurring transactions
// router.get('/recurring', 
//   ValidationMiddleware.validatePagination(),
//   transactionController.getRecurringTransactions
// );

// router.post('/recurring', 
//   ValidationMiddleware.validateRecurringTransaction(),
//   transactionController.createRecurringTransaction
// );

// router.put('/recurring/:id', 
//   ValidationMiddleware.validateObjectId('id'),
//   ValidationMiddleware.validateRecurringTransactionUpdate(),
//   transactionController.updateRecurringTransaction
// );

// router.delete('/recurring/:id', 
//   ValidationMiddleware.validateObjectId('id'),
//   transactionController.cancelRecurringTransaction
// );

// // Transaction verification and confirmation
// router.post('/:id/verify', 
//   ValidationMiddleware.validateObjectId('id'),
//   ValidationMiddleware.validateTransactionVerification(),
//   transactionController.verifyTransaction
// );

// router.post('/:id/confirm', 
//   ValidationMiddleware.validateObjectId('id'),
//   transactionController.confirmTransaction
// );

// router.post('/:id/cancel', 
//   ValidationMiddleware.validateObjectId('id'),
//   transactionController.cancelTransaction
// );

// // Transaction receipts and documentation
// router.get('/:id/receipt', 
//   ValidationMiddleware.validateObjectId('id'),
//   transactionController.getTransactionReceipt
// );

// router.get('/:id/receipt/download', 
//   ValidationMiddleware.validateObjectId('id'),
//   transactionController.downloadTransactionReceipt
// );

// // Transaction disputes
// router.post('/:id/dispute', 
//   ValidationMiddleware.validateObjectId('id'),
//   ValidationMiddleware.validateDispute(),
//   transactionController.disputeTransaction
// );

// router.get('/disputes', 
//   ValidationMiddleware.validatePagination(),
//   transactionController.getDisputes
// );

// // Transaction analytics (user level)
// router.get('/analytics/summary', 
//   ValidationMiddleware.validateAnalyticsRequest(),
//   transactionController.getTransactionSummary
// );

// router.get('/analytics/spending', 
//   ValidationMiddleware.validateAnalyticsRequest(),
//   transactionController.getSpendingAnalytics
// );

// router.get('/analytics/categories', 
//   ValidationMiddleware.validateAnalyticsRequest(),
//   transactionController.getCategoryAnalytics
// );

// // Admin only routes
// router.use(AuthMiddleware.authorize('admin'));

// router.get('/admin/all', 
//   ValidationMiddleware.validatePagination(),
//   ValidationMiddleware.validateAdminTransactionFilters(),
//   transactionController.getAllTransactions
// );

// router.put('/:id/admin/status', 
//   ValidationMiddleware.validateObjectId('id'),
//   ValidationMiddleware.validateAdminStatusUpdate(),
//   transactionController.updateTransactionStatusAdmin
// );

// router.get('/admin/stats', transactionController.getTransactionStats);

// router.get('/admin/suspicious', 
//   ValidationMiddleware.validatePagination(),
//   transactionController.getSuspiciousTransactions
// );

// router.post('/:id/admin/flag', 
//   ValidationMiddleware.validateObjectId('id'),
//   ValidationMiddleware.validateTransactionFlag(),
//   transactionController.flagTransaction
// );

// export default router;