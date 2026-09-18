"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const db_1 = require("../config/db");
const user_model_1 = require("../features/auth/user.model");
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
(async () => {
    await (0, db_1.connectDB)();
    const users = await user_model_1.User.find({ email: /@globilive\.com$/ })
        .select('username email role createdAt tokenVersion')
        .lean();
    console.log(`\nFound ${users.length} globilive.com accounts:\n`);
    users.forEach((u) => {
        console.log(`  [${u.role.padEnd(15)}] ${u.email}  (tokenVersion: ${u.tokenVersion})`);
    });
    console.log('');
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
