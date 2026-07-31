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
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    const connStr = process.env.MONGO_URI;
    if (!connStr) {
        console.error('❌ MONGO_URI is not defined in environment variables.');
        // Do not exit — let the server start so Railway healthcheck passes.
        // API routes requiring DB will fail gracefully; other routes still work.
        return;
    }
    // Attach persistent connection event listeners (fire once, not per-call)
    mongoose_1.default.connection.on('connected', () => {
        console.log('📦 MongoDB Atlas connected.');
    });
    mongoose_1.default.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB Atlas disconnected. Mongoose will auto-reconnect.');
    });
    mongoose_1.default.connection.on('error', (err) => {
        console.error('❌ MongoDB connection error:', err.message);
    });
    try {
        await mongoose_1.default.connect(connStr, {
            // Give Atlas time to respond on Railway cold starts
            serverSelectionTimeoutMS: 15000,
            // Keep streaming sockets alive under variable cross-cloud latency
            socketTimeoutMS: 45000,
            // Aggressively retry initial connection (useful after Railway cold starts)
            connectTimeoutMS: 10000,
            // Keep the pool lean for a single-instance Railway deployment
            maxPoolSize: 10,
            minPoolSize: 2,
        });
        // Run async sync for multi-role support
        syncMultiRoleIndexes().catch(() => { });
    }
    catch (error) {
        console.error('❌ Initial MongoDB connection failed:', error.message);
        // Log but do not crash — healthcheck must pass so Railway keeps the container alive.
        // Without a running process Railway marks deployment as failed immediately.
    }
};
exports.connectDB = connectDB;
async function syncMultiRoleIndexes() {
    try {
        const { User } = await Promise.resolve().then(() => __importStar(require('../features/auth/user.model')));
        const bcrypt = (await Promise.resolve().then(() => __importStar(require('bcryptjs')))).default;
        // Drop legacy unique index on email & phone to allow multi-role accounts
        await User.collection.dropIndex('email_1').catch(() => { });
        await User.collection.dropIndex('phone_1').catch(() => { });
        // Ensure haniijaz896@gmail.com has both super_admin and top_up_agent accounts
        const email = 'haniijaz896@gmail.com';
        const saUser = await User.findOne({ email, role: 'super_admin' });
        if (!saUser) {
            const existingUser = await User.findOne({ email });
            const passwordHash = existingUser?.passwordHash || (await bcrypt.hash('Gobilive@123', 10));
            await User.create({
                username: 'hani_ijaj_sa',
                email: email,
                passwordHash,
                role: 'super_admin',
                phone: existingUser?.phone || '03459831871',
                country: existingUser?.country || 'Pakistan',
                isBlocked: false,
                isSuspended: false,
                isTerminated: false,
                beanWallet: 0,
            });
            console.log('✅ Auto-created super_admin account for haniijaz896@gmail.com');
        }
    }
    catch (err) {
        console.warn('⚠️ Index / account sync warning:', err.message);
    }
}
