import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function check() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gobilive';
  console.log('Connecting to', uri);
  await mongoose.connect(uri);

  const posts = await mongoose.connection.collection('posts').find({}).sort({ createdAt: -1 }).limit(10).toArray();
  console.log('Recent 10 posts:');
  for (const p of posts) {
    const u = await mongoose.connection.collection('users').findOne({ _id: p.userId });
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
