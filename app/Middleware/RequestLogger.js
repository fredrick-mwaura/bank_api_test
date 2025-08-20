import logger from '../utils/logger.js'
import path from 'path'

function getCallerInfo() {
  const error = new Error()
  const stackLines = error.stack.split('\n')

  // Look further down the stack to avoid always showing middleware itself
  const callerLine = stackLines[4] || stackLines[3]
  const match = callerLine.match(/\((.*):(\d+):(\d+)\)/)

  if (match) {
    return {
      file: path.relative(process.cwd(), match[1]),
      line: match[2],
      column: match[3]
    }
  }
  return {}
}

export const requestLogger = (req, res, next) => {
  const start = Date.now()
  const caller = getCallerInfo()

  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    ...caller
  })

  const originalEnd = res.end
  res.end = function (chunk, encoding) {
    const duration = Date.now() - start
    const caller = getCallerInfo()

    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      timestamp: new Date().toISOString(),
      ...caller
    })

    return originalEnd.call(this, chunk, encoding)
  }

  next()
}