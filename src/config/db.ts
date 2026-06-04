import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const connStr = process.env.MONGO_URI;

  if (!connStr) {
    console.error('❌ MONGO_URI is not defined in environment variables.');
    process.exit(1);
  }

  // Attach persistent connection event listeners (fire once, not per-call)
  mongoose.connection.on('connected', () => {
    console.log('📦 MongoDB Atlas connected.');
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB Atlas disconnected. Mongoose will auto-reconnect.');
  });
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  try {
    await mongoose.connect(connStr, {
      // Fail fast if Atlas cluster is recovering — prevents server freeze on boot
      serverSelectionTimeoutMS: 5000,
      // Keep streaming sockets alive under variable cross-cloud latency
      socketTimeoutMS: 45000,
      // Aggressively retry initial connection (useful after Railway cold starts)
      connectTimeoutMS: 10000,
      // Keep the pool lean for a single-instance Railway deployment
      maxPoolSize: 10,
      minPoolSize: 2,
    });
  } catch (error) {
    console.error('❌ Initial MongoDB connection failed:', (error as Error).message);
    process.exit(1);
  }
};
