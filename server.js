import app from './app/app.js'
import connectDB from './config/database.js'
import logger from './app/utils/logger.js'
import { config } from './config/index.js'


const port = config.app.port|| 5000

connectDB();

const server = app.listen(port, () => {
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