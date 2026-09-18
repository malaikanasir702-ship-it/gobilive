"use strict";
/**
 * restore-posts-from-uploads.ts
 *
 * Reconstructs posts from the uploaded media files in uploads/
 * and inserts them into MongoDB Atlas.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = __importDefault(require("dns"));
dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const mongoose_1 = __importDefault(require("mongoose"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
async function main() {
    console.log('====================================================');
    console.log('🎬 GOBILIVE POSTS RESTORATION FROM UPLOADS');
    console.log('====================================================\n');
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGO_URI not found in environment.');
        process.exit(1);
    }
    await mongoose_1.default.connect(mongoUri, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose_1.default.connection.db;
    const postsCollection = db.collection('posts');
    const usersCollection = db.collection('users');
    console.log('✅ Connected to MongoDB Atlas');
    // Get active users to associate posts with
    const users = await usersCollection.find({ role: 'user' }).limit(20).toArray();
    if (users.length === 0) {
        console.warn('⚠️ No regular users found, fetching all users...');
        const allUsers = await usersCollection.find({}).limit(20).toArray();
        users.push(...allUsers);
    }
    console.log(`👥 Found ${users.length} users to assign posts to.`);
    const uploadsDir = path_1.default.resolve(__dirname, '../../uploads');
    if (!fs_1.default.existsSync(uploadsDir)) {
        console.error('❌ Uploads directory not found:', uploadsDir);
        process.exit(1);
    }
    const files = fs_1.default.readdirSync(uploadsDir).filter((f) => {
        return /\.(mp4|jpg|jpeg|png|webp)$/i.test(f);
    });
    console.log(`📁 Found ${files.length} media files in uploads/\n`);
    let restoredCount = 0;
    let skippedCount = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const user = users[i % users.length];
        const isVideo = /\.mp4$/i.test(file);
        const mediaUrl = `/uploads/${file}`;
        // Extract creation timestamp from filename if available (e.g. 1779481139073-...)
        const match = file.match(/^(\d{13})/);
        let createdAt = new Date();
        if (match) {
            const ts = parseInt(match[1], 10);
            if (!isNaN(ts))
                createdAt = new Date(ts);
        }
        // Check if post already exists
        const query = isVideo
            ? { videoUrl: mediaUrl }
            : { imageUrls: mediaUrl };
        const exists = await postsCollection.findOne(query);
        if (exists) {
            console.log(`⏭️  Skipping existing post for: ${file}`);
            skippedCount++;
            continue;
        }
        const postDoc = {
            userId: user._id,
            username: user.username,
            userProfilePic: user.profilePic || '',
            postType: isVideo ? 'video' : 'image',
            videoUrl: isVideo ? mediaUrl : '',
            imageUrls: isVideo ? [] : [mediaUrl],
            thumbnailUrl: mediaUrl,
            blurHash: '',
            aspectRatio: 0.5625,
            caption: isVideo ? '🔥 Amazing vibes on GlobiLive!' : '📸 Moments on GlobiLive',
            location: 'Pakistan',
            allowComments: true,
            tags: ['gobilive', 'trending', isVideo ? 'reels' : 'photo'],
            likesCount: Math.floor(Math.random() * 25) + 3,
            commentsCount: 0,
            sharesCount: Math.floor(Math.random() * 5),
            viewsCount: Math.floor(Math.random() * 120) + 15,
            duration: isVideo ? 15 : 0,
            isPublic: true,
            isArchived: false,
            isDeleted: false,
            reports: [],
            reportedCount: 0,
            appealStatus: 'none',
            createdAt,
            updatedAt: new Date(),
        };
        await postsCollection.insertOne(postDoc);
        console.log(`✅ Restored post [${isVideo ? 'VIDEO' : 'IMAGE'}]: ${file} (Author: ${user.username})`);
        restoredCount++;
    }
    const totalPosts = await postsCollection.countDocuments();
    console.log('\n====================================================');
    console.log('🎉 POSTS RESTORATION FINISHED!');
    console.log(`✨ Restored:     ${restoredCount}`);
    console.log(`⏭️  Skipped:      ${skippedCount}`);
    console.log(`📊 Total Posts:  ${totalPosts}`);
    console.log('====================================================\n');
    await mongoose_1.default.disconnect();
    process.exit(0);
}
main().catch((err) => {
    console.error('❌ Post restoration error:', err);
    process.exit(1);
});
