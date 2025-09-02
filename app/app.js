import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import compression from 'compression'
import {errorHandler} from './Middleware/ErrorHandler.js'
import { rateLimiters } from './Middleware/RateLimiter.js'
import authRoutes from '../routes/auth.js'
import userRoutes from '../routes/users.js'
// import accountRoutes from '../routes/account.js'
import transactionRoutes from '../routes/transaction.js'
import { requestLogger } from './Middleware/RequestLogger.js'
import { config } from '../config/index.js'
import logger from './utils/logger.js'
import expressLayouts from 'express-ejs-layouts'
import adminRoutes from '../routes/admin.js'

const app = express()

app.use(helmet())

// A helper to catch route definition errors
function wrapMethod(app, method) {
  const orig = app[method].bind(app);

  app[method] = function (path, ...handlers) {
    try {
      // Validate that path is a string or regex before Express tries to compile
      if (typeof path === "string" && path.includes(":")) {
        // quick sanity check for invalid `:`
        if (/:(\/|$)/.test(path)) {
          console.error(` Suspicious path detected (${method.toUpperCase()}): "${path}"`);
        }
      }
      return orig(path, ...handlers);
    } catch (err) {
      console.error(`Route registration failed (${method.toUpperCase()}): "${path}"`);
      throw err;
    }
  };
}

// Patch verbs
["get", "post", "put", "delete", "patch", "all", "use"].forEach((method) =>
  wrapMethod(app, method)
);

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, _res, next) => {
	Object.defineProperty(req, 'query', {
		...Object.getOwnPropertyDescriptor(req, 'query'),
		value: req.query,
		writable: true,
	})

	next()
})

app.use(mongoSanitize())


/* const securityHeaders = (req, res, next) => {
   res.setHeaders("X-Content-Type-Options", "nosniff");
   res.setHeader("X-Frame-Options", "DENY");
   res.setHeaders("X-XSS-Protection", "1; mode=block");
   next();
 }
*/

app.set("view engine", "ejs");
app.set("views", "Resources/Views");

// layouts
// app.use(expressLayouts);
// app.set("layout", "layouts/main");

//rate limiting behind reverse proxy
app.set('trust proxy', 1)
app.use(cors({
  origin: config.cors.origin, // http://localhost:3000
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
app.use(express.static('public'))

//status
app.get('/', (req, res)=> {
  if(req.method !== "GET") return res.status(405).json({
    status: "error",
    message: "Method not allowed"
  })

  res.status(200).json({
    status: 'success',
    message: 'APP is running',
    timestamp: new Date().toISOString(),
    environment: config.app.env || 'dev'
  });
});

//group routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
// app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes)
app.use('/fengi', adminRoutes)

//500 - unhandled errors
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err,
    req: req
  });
  console.log("server error", err)
  res.status(500).json({
    status: 'error',
    message: 'Internal Server Error'
  });
})

//handle 404
app.use((req, res) => {
  logger.info(`Route not found: ${req.originalUrl}`, {
    params_included: req.params
  });
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

//exceptions
app.use(errorHandler)

export default app;