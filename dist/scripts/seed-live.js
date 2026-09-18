"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = __importDefault(require("dns"));
dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const db_1 = require("../config/db");
const live_seed_1 = require("../features/live/live.seed");
(async () => {
    await (0, db_1.connectDB)();
    const created = await (0, live_seed_1.ensureLiveDiscoverySeed)();
    console.log(created > 0 ? `Done. Created ${created} room(s).` : 'Active rooms already exist — nothing to seed.');
    process.exit(0);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
