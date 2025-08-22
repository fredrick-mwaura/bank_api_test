import app from './app/app.js'
import db from './config/database.js'
import logger from './app/utils/logger.js'
import { config } from './config/index.js'


const port = config.app.port|| 5000

try {
  await db.connectDB();
  console.info('Database connected');
} catch (err) {
  console.error('Failed to connect DB:', err);
  process.exit(1);
}

const server = app.listen(port, () => {
  logger.info(`server running at port ${port}`)
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