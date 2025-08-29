import app from './app/app.js'
import db from './config/database.js'
import logger from './app/utils/logger.js'
import { config } from './config/index.js'
import isPortReachable from 'is-port-reachable'

let port = config.app.port|| 8000

const isPortAvailable = async (p) => {
  const inUse = await isPortReachable(p, {host: 'localhost'});
  if(inUse){
    console.log(`port ${p} is in use, trying ${port+1}`);
    return false
  }
  return true
}

// find a free port
const findPort = async (start) => {
  let currentPort = start;
  while (!(await isPortAvailable(currentPort))) {
    console.log(`Trying to connect port ${currentPort + 1}...`);
    currentPort++;
  }
  return currentPort;
};

(async () => {
  try {
    await db.connectDB();
    console.info('Database connected');
  } catch (err) {
    console.error('Failed to connect DB:', err);
    process.exit(1);
  }

  port = await findPort(port);

  const server = app.listen(port, () => {
    logger.info(`Server running at port ${port}`);
  });

  process.on('unhandledRejection', (error) => {
    logger.error('Unhandled rejection:', error.message);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error.message);
    process.exit(1);
  });
})();