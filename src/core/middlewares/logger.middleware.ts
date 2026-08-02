import winston from 'winston';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';

// ── Ensure logs directory exists ─────────────────────────────────────────────
const logsDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ── Winston logger (structured file + console) ───────────────────────────────
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Access log — all HTTP requests
    new winston.transports.File({
      filename: path.join(logsDir, 'access.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 7,               // keep 7 rotated files
      tailable: true,
    }),
    // Error log — errors only
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 7,
      tailable: true,
    }),
  ],
});

// Console output in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

// ── Morgan HTTP request logger ────────────────────────────────────────────────
// Stream morgan output into winston
const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

/**
 * Morgan middleware — use 'combined' in production, 'dev' in development.
 * Pipe to winston so logs go to file.
 */
export const httpLogger = morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev',
  { stream: morganStream }
);

export default logger;
