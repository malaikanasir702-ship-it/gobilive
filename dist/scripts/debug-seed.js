"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
(async () => {
    console.log('MONGO_URI:', process.env.MONGO_URI?.substring(0, 50) + '...');
    await mongoose_1.default.connect(process.env.MONGO_URI);
    console.log('Connected to DB:', mongoose_1.default.connection.name);
    const db = mongoose_1.default.connection.db;
    // Count all users
    const total = await db.collection('users').countDocuments();
    console.log(`Total users in DB: ${total}`);
    // Find globilive accounts
    const globiUsers = await db.collection('users').find({ email: { $regex: '@globilive\\.com$' } }).project({ username: 1, email: 1, role: 1 }).toArray();
    console.log(`\nglobilive.com accounts found: ${globiUsers.length}`);
    globiUsers.forEach(u => console.log(`  ${u.email} — ${u.role}`));
    // Check recently created
    const recent = await db.collection('users').find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .project({ username: 1, email: 1, role: 1, createdAt: 1 })
        .toArray();
    console.log('\nLast 10 created users:');
    recent.forEach(u => console.log(`  ${u.email} | ${u.role} | ${u.createdAt}`));
    process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
