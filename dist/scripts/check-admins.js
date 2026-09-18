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
    await mongoose_1.default.connect(process.env.MONGO_URI);
    const db = mongoose_1.default.connection.db;
    const total = await db.collection('users').countDocuments();
    console.log(`\nTotal users: ${total}`);
    // Find all admin roles
    const admins = await db.collection('users').find({
        role: { $in: ['company_admin', 'super_admin', 'sub_admin', 'agency', 'sub_agency', 'top_up_agent', 'reseller'] }
    }).project({ username: 1, email: 1, role: 1, tokenVersion: 1 }).toArray();
    console.log(`\nAdmin accounts (${admins.length}):`);
    admins.forEach((u) => {
        console.log(`  [${String(u.role).padEnd(15)}] ${u.email ?? '(no email)'}  @${u.username}  tv:${u.tokenVersion ?? 0}`);
    });
    process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
