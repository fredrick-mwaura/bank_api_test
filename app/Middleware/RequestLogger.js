import logger from '../utils/logger'

export const requestLogger = (req, res, next)=>{
  const start = Date.now()

  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  const originalEnd = res.end;
  res.end = (chunk, encoding) => {
    const duration = Date.now() - start;
    //resp
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    originalEnd.call(this, chunk, encoding);
  };
  next()
}