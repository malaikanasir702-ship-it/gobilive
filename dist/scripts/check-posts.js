"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../../.env') });
async function check() {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gobilive';
    console.log('Connecting to', uri);
    await mongoose_1.default.connect(uri);
    const posts = await mongoose_1.default.connection.collection('posts').find({}).sort({ createdAt: -1 }).limit(10).toArray();
    console.log('Recent 10 posts:');
    for (const p of posts) {
        const u = await mongoose_1.default.connection.collection('users').findOne({ _id: p.userId });
        console.log({
            id: p._id,
            username: p.username,
            caption: p.caption,
            isPublic: p.isPublic,
            isDeleted: p.isDeleted,
            isArchived: p.isArchived,
            userIsPrivate: u?.isPrivate,
            createdAt: p.createdAt,
        });
    }
    process.exit(0);
}
check().catch((err) => {
    console.error(err);
    process.exit(1);
});
