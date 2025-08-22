import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import compression from 'compression'
import dotenv from 'dotenv'
import {errorHandler} from './Middleware/ErrorHandler.js'
import { rateLimiters } from './Middleware/RateLimiter.js'
import authRoutes from '../routes/auth.js'
import userRoutes from '../routes/users.js'
// import accountRoutes from '../routes/account.js'
// import transactionRoutes from '../routes/transaction.js'
import { requestLogger } from './Middleware/RequestLogger.js'
import { config } from '../config/index.js'

const app = express()

dotenv.config();

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

//rate limiting behind reverse proxy
app.set('trust proxy', 1)

//security middleware
// app.use(
//   helmet.contentSecurityPolicy({
//     directives: {
//       defaultSrc: ["'self'"],
//       scriptSrc: ["'self'", "'nonce-firebase_hehe"]
//     }
//   })
// )
// app.use(securityHeaders);
app.use(cors({
  origin: config.cors.origin, //||fallback
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
app.get('/connection-health', (req, res)=> {
  if(req.method !== "GET") return
  console.log(config.jwt.expiresIn)
  console.log('allllo', config.security.encryptionKey.length)

  res.status(200).json({
    status: 'success',
    message: 'API running',
    len: config.security.encryptionKey.length,
    iss: config.jwt.issuer,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'dev'
  });
});

//grouping routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
// app.use('/api/accounts', accountRoutes);
// app.use('/api/transactions', transactionRoutes)
app.use('auth', authRoutes)

//handle 404

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`
  });
});

// app.use((req, res, next) => {
//   let _query = req.query;
//   Object.defineProperty(req, "query", {
//     get: () => _query,
//     set: (val) => {
//       console.trace("⚠️ req.query was reassigned:", val);
//       throw new Error("Do not assign req.query directly");
//     },
//     configurable: true
//   });
//   next();
// });


//exceptions
app.use(errorHandler)

export default app;