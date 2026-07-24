import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const connStr = process.env.MONGO_URI;

  if (!connStr) {
    console.error('❌ MONGO_URI is not defined in environment variables.');
    // Do not exit — let the server start so Railway healthcheck passes.
    // API routes requiring DB will fail gracefully; other routes still work.
    return;
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
      // Give Atlas time to respond on Railway cold starts
      serverSelectionTimeoutMS: 15000,
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
    // Log but do not crash — healthcheck must pass so Railway keeps the container alive.
    // Without a running process Railway marks deployment as failed immediately.
  }
};
