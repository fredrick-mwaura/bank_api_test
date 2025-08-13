import app from './app/app.js'
import connectDB from './config/index.js'
import logger from './app/utils/logger.js'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 5000

connectDB();

const server = app.listen(PORT, () => {
  logger.info('server running.')
})

process.on('unhandledRejection', (error, promise) => {
  logger.error('unhandled rejection :', error.message);
  server.close(() => {
    process.exit(1)
  })
})

process.on('uncaughtException', (error) => {
  logger.error('uncaught exception: ', error.message)
  process.exit(1);
})