"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerActivitySignaling = registerActivitySignaling;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const activity_service_1 = require("./activity.service");
function verifyToken(socket) {
    const token = socket.handshake.auth?.token;
    if (!token)
        return null;
    try {
        return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || 'super_secret_gobilive_token_key_123!');
    }
    catch {
        return null;
    }
}
function registerActivitySignaling(io) {
    // Inject io so activity.service.ts can emit without coupling
    (0, activity_service_1.injectActivityIo)(io);
    io.on('connection', (socket) => {
        const user = verifyToken(socket);
        if (!user)
            return;
        // Join user's personal room for activity delivery
        socket.join(`user_${user.id}`);
        socket.on('activity_mark_read', async (data) => {
            if (!data?.activityId)
                return;
            try {
                const { markActivityRead } = await Promise.resolve().then(() => __importStar(require('./activity.service')));
                await markActivityRead(user.id, data.activityId);
            }
            catch (_) { }
        });
        socket.on('activity_mark_all_read', async () => {
            try {
                const { markAllActivitiesRead } = await Promise.resolve().then(() => __importStar(require('./activity.service')));
                await markAllActivitiesRead(user.id);
            }
            catch (_) { }
        });
        socket.on('disconnect', () => {
            socket.leave(`user_${user.id}`);
        });
    });
    console.log('📣 Activity signaling registered');
}
