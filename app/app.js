import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import compression from 'compression'
import { configDotenv } from 'dotenv'
import errorHandler from './Middleware/ErrorHandler.js'
import { rateLimiters } from './Middleware/RateLimiter.js'
import authRoutes from '../routes/auth.js'
import userRoutes from '../routes/users.js'
import accountRoutes from '../routes/account.js'
import transactionRoutes from '../routes/transaction.js'
import { requestLogger } from './Middleware/RequestLogger.js'

const app = express()

//rate limiting behind reverse proxy
app.set('trust proxy', 1)

//security middleware
app.use(helmet())
app.use(securityHeaders);
app.use(cors({
  origin: process.env.FRONTEND_URL, //||fallback
  credentials: true,
  methods:[
    'GET', 'POST', 'PUT', 'DELETE', 'PATCH'
  ],
  allowedHeaders: [
    'Content-Type',
    'Authorization'
  ]
}));

//parsing middleware:

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}))

app.use(mongoSanitize());
app.use(compression())
app.use(requestLogger);
app.use('/api', rateLimiters.global);

//status
app.get('/connection-health', (req, res)=> {
  res.status(200).json({
    status: 'success',
    message: 'API running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'dev'
  });
});

//grouping routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes)

//handle 404

app.use('*', (req, res) => {
  return res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  })
})

//exceptions
app.use(errorHandler)

export default app;