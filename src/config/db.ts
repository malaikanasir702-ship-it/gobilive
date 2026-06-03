import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded correctly in both src (dev) and dist (start)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const connectDB = async (): Promise<void> => {
  try {
    const connStr = process.env.MONGO_URI || 'mongodb://localhost:27017/gobilive';
    await mongoose.connect(connStr);
    console.log('📦 MongoDB Connected successfully.');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};
