"use strict";
/**
 * Seed script — adds sample sounds to the database.
 * Run: npx ts-node src/scripts/seed-sounds.ts
 *
 * URLs use SoundHelix free samples (royalty-free for testing).
 * Replace with your own Cloudinary/S3 URLs for production.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
const mongoose_1 = __importDefault(require("mongoose"));
const sound_model_1 = require("../features/sound/sound.model");
const SOUNDS = [
    {
        title: 'Upbeat Vibe',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        coverUrl: 'https://picsum.photos/seed/sound1/200/200',
        duration: 30,
        genre: 'trending',
        usageCount: 12400,
    },
    {
        title: 'Chill Beat',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        coverUrl: 'https://picsum.photos/seed/sound2/200/200',
        duration: 30,
        genre: 'pop',
        usageCount: 8300,
    },
    {
        title: 'Electronic Flow',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
        coverUrl: 'https://picsum.photos/seed/sound3/200/200',
        duration: 30,
        genre: 'electronic',
        usageCount: 5600,
    },
    {
        title: 'Hip Hop Groove',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        coverUrl: 'https://picsum.photos/seed/sound4/200/200',
        duration: 30,
        genre: 'hip-hop',
        usageCount: 9100,
    },
    {
        title: 'R&B Smooth',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        coverUrl: 'https://picsum.photos/seed/sound5/200/200',
        duration: 30,
        genre: 'rnb',
        usageCount: 4200,
    },
    {
        title: 'Summer Pop',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
        coverUrl: 'https://picsum.photos/seed/sound6/200/200',
        duration: 30,
        genre: 'pop',
        usageCount: 7700,
    },
    {
        title: 'Deep House',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
        coverUrl: 'https://picsum.photos/seed/sound7/200/200',
        duration: 30,
        genre: 'electronic',
        usageCount: 3100,
    },
    {
        title: 'Lo-Fi Study',
        artist: 'SoundHelix',
        url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
        coverUrl: 'https://picsum.photos/seed/sound8/200/200',
        duration: 30,
        genre: 'trending',
        usageCount: 18900,
    },
];
async function main() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌  MONGODB_URI not found in .env');
        process.exit(1);
    }
    await mongoose_1.default.connect(mongoUri);
    console.log('✅  Connected to MongoDB');
    const existing = await sound_model_1.Sound.countDocuments();
    if (existing > 0) {
        console.log(`ℹ️   ${existing} sounds already exist — skipping seed.`);
        await mongoose_1.default.disconnect();
        return;
    }
    const inserted = await sound_model_1.Sound.insertMany(SOUNDS);
    console.log(`✅  Inserted ${inserted.length} sounds successfully.`);
    await mongoose_1.default.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
