import winston from 'winston'
import path from 'path'
import { config } from '../../config/index.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const appLog = '../../Resources/log/app.log'
const ErrorLog = '../../Resources/log/error.log'

// 👉 custom format to add file + line
const addFileInfo = winston.format((info) => {
  const error = new Error()
  const stackLines = error.stack.split('\n')
  
  // 3rd or 4th line usually points to the caller (skip the first ones)
  const callerLine = stackLines[10] || stackLines[3]
  const match = callerLine.match(/\((.*):(\d+):(\d+)\)/)
  if (match) {
    info.file = path.relative(process.cwd(), match[1])
    info.line = match[2]
    info.column = match[3]
  }

  return info
})

const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: winston.format.combine(
    addFileInfo(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'banking-api' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, ErrorLog),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, appLog)
    })
  ]
})

if (config.app.env !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ level, message, file, line, timestamp }) => {
        return `${timestamp} [${level}] ${file || ''}:${line || ''} - ${message}`
      })
    )
  }))
}

export default logger
