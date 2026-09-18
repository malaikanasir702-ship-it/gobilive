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
    const uri = process.env.MONGO_URI;
    console.log('Connecting to:', uri.replace(/:([^@]+)@/, ':****@'));
    await mongoose_1.default.connect(uri);
    const admin = mongoose_1.default.connection.db.admin();
    // List all databases
    const { databases } = await admin.listDatabases();
    console.log('\nAll databases on this cluster:');
    databases.forEach((db) => console.log(`  ${db.name}  (${(db.sizeOnDisk / 1024).toFixed(1)} KB)`));
    // Check current db name
    console.log('\nCurrent DB name:', mongoose_1.default.connection.db.databaseName);
    // List collections in current db
    const cols = await mongoose_1.default.connection.db.listCollections().toArray();
    console.log('\nCollections in current DB:');
    cols.forEach(c => console.log(`  ${c.name}`));
    process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
