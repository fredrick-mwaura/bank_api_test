import winston from 'winston'
import path from 'path'
import {config} from '../../config/index.js'
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appLog = '../../Resources/log/app.log'
const ErrorLog = '../../Resources/log/error.log'


const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'banking-api' },
  transports: [
    // Write all logs with importance level of 'error' or less to error.log
    new winston.transports.File({ 
      filename: path.join(__dirname, ErrorLog), 
      level: 'error' 
    }),
    
    // Write all logs with importance level of 'info' or less to combined.log
    new winston.transports.File({ 
      filename: path.join(__dirname, appLog) 
    })
  ]
});

// If we're not in production, log to the console as well
if (config.app.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;