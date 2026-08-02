"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const morgan_1 = __importDefault(require("morgan"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ── Ensure logs directory exists ─────────────────────────────────────────────
const logsDir = path_1.default.resolve(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
// ── Winston logger (structured file + console) ───────────────────────────────
exports.logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    transports: [
        // Access log — all HTTP requests
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'access.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 7, // keep 7 rotated files
            tailable: true,
        }),
        // Error log — errors only
        new winston_1.default.transports.File({
            filename: path_1.default.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 7,
            tailable: true,
        }),
    ],
});
// Console output in development
if (process.env.NODE_ENV !== 'production') {
    exports.logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }));
}
// ── Morgan HTTP request logger ────────────────────────────────────────────────
// Stream morgan output into winston
const morganStream = {
    write: (message) => {
        exports.logger.info(message.trim());
    },
};
/**
 * Morgan middleware — use 'combined' in production, 'dev' in development.
 * Pipe to winston so logs go to file.
 */
exports.httpLogger = (0, morgan_1.default)(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: morganStream });
exports.default = exports.logger;
