"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * direct-seed.ts — inserts admin seed accounts directly via MongoDB driver
 * bypassing Mongoose model validation issues
 */
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const SEED_USERS = [
    { username: 'company_admin', email: 'company_admin@gobilive.com', password: 'Admin@1234', role: 'company_admin' },
    { username: 'super_admin1', email: 'super_admin@gobilive.com', password: 'Admin@1234', role: 'super_admin' },
    { username: 'sub_admin1', email: 'sub_admin@gobilive.com', password: 'Admin@1234', role: 'sub_admin' },
    { username: 'agency1', email: 'agency@gobilive.com', password: 'Admin@1234', role: 'agency' },
    { username: 'sub_agency1', email: 'sub_agency@gobilive.com', password: 'Admin@1234', role: 'sub_agency' },
    { username: 'top_up_agent1', email: 'topupagent@gobilive.com', password: 'Admin@1234', role: 'top_up_agent' },
    { username: 'reseller1', email: 'reseller@gobilive.com', password: 'Admin@1234', role: 'reseller' },
];
(async () => {
    console.log('\nConnecting to MongoDB...');
    await mongoose_1.default.connect(process.env.MONGO_URI);
    const db = mongoose_1.default.connection.db;
    const col = db.collection('users');
    const total = await col.countDocuments();
    console.log(`DB: ${db.databaseName}  |  Total users: ${total}\n`);
    // Remove any existing seed accounts (both old and new emails)
    const seedEmails = SEED_USERS.map(u => u.email);
    const allSeedEmails = [
        ...seedEmails,
        // Also remove the previous @globilive.com versions
        'company_admin@globilive.com',
        'super_admin@globilive.com',
        'sub_admin@globilive.com',
        'agency@globilive.com',
        'sub_agency@globilive.com',
        'topupagent@globilive.com',
        'reseller@globilive.com',
    ];
    const del = await col.deleteMany({ email: { $in: allSeedEmails } });
    console.log(`Deleted ${del.deletedCount} existing seed account(s)\n`);
    // Insert fresh
    for (const u of SEED_USERS) {
        const passwordHash = await bcryptjs_1.default.hash(u.password, 10);
        const now = new Date();
        await col.insertOne({
            username: u.username,
            email: u.email,
            passwordHash,
            role: u.role,
            authProvider: 'local',
            beanWallet: 0,
            diamonds: 0,
            rcoins: 0,
            sharePercent: 0,
            isBlocked: false,
            isTerminated: false,
            isSuspended: false,
            tokenVersion: 1,
            badges: [],
            createdAt: now,
            updatedAt: now,
        });
        console.log(`✅ Inserted  [${u.role.padEnd(15)}] ${u.email}`);
    }
    // Verify
    const after = await col.countDocuments();
    const seeded = await col.find({ email: { $in: seedEmails } }).project({ email: 1, role: 1 }).toArray();
    console.log(`\nTotal users now: ${after}`);
    console.log(`Seed accounts confirmed: ${seeded.length}`);
    seeded.forEach((u) => console.log(`  ${u.email}  — ${u.role}`));
    console.log('\n✔  Done\n');
    process.exit(0);
})().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
