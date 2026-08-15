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

    // Run async sync for multi-role support
    syncMultiRoleIndexes().catch(() => {});
  } catch (error) {
    console.error('❌ Initial MongoDB connection failed:', (error as Error).message);
    // Log but do not crash — healthcheck must pass so Railway keeps the container alive.
    // Without a running process Railway marks deployment as failed immediately.
  }
};

async function syncMultiRoleIndexes() {
  try {
    const { User } = await import('../features/auth/user.model');
    const bcrypt = (await import('bcryptjs')).default;

    // Drop legacy unique index on email & phone to allow multi-role accounts
    await User.collection.dropIndex('email_1').catch(() => {});
    await User.collection.dropIndex('phone_1').catch(() => {});

    // Ensure haniijaz896@gmail.com has both super_admin and top_up_agent accounts
    const email = 'haniijaz896@gmail.com';
    const saUser = await User.findOne({ email, role: 'super_admin' });
    if (!saUser) {
      const existingUser = await User.findOne({ email });
      const passwordHash = existingUser?.passwordHash || (await bcrypt.hash('Gobilive@123', 10));
      await User.create({
        username: 'hani_ijaj_sa',
        email: email,
        passwordHash,
        role: 'super_admin',
        phone: existingUser?.phone || '03459831871',
        country: existingUser?.country || 'Pakistan',
        isBlocked: false,
        isSuspended: false,
        isTerminated: false,
        beanWallet: 0,
      });
      console.log('✅ Auto-created super_admin account for haniijaz896@gmail.com');
    }

    // Migrate & sync legacy rcoins into beanWallet for existing users
    await syncLegacyRcoinsToBeans(User);
  } catch (err: any) {
    console.warn('⚠️ Index / account sync warning:', err.message);
  }
}

async function syncLegacyRcoinsToBeans(User: any) {
  try {
    const usersToSync = await User.find({
      $or: [
        { rcoins: { $gt: 0 } },
        { beanWallet: { $gt: 0 } }
      ]
    }).select('_id rcoins beanWallet').lean();

    for (const u of usersToSync) {
      const oldRcoins = u.rcoins ?? 0;
      const currentBeans = u.beanWallet ?? 0;

      // If rcoins was positive and different from beanWallet, add old rcoins to beanWallet
      if (oldRcoins > 0 && currentBeans > 0 && oldRcoins !== currentBeans) {
        const total = currentBeans + oldRcoins;
        await User.findByIdAndUpdate(u._id, { beanWallet: total, rcoins: total });
        console.log(`✅ Synced user ${u._id}: combined ${currentBeans} + ${oldRcoins} = ${total} Beans`);
      } else if (oldRcoins > 0 && currentBeans === 0) {
        await User.findByIdAndUpdate(u._id, { beanWallet: oldRcoins });
      } else if (currentBeans > 0 && oldRcoins === 0) {
        await User.findByIdAndUpdate(u._id, { rcoins: currentBeans });
      }
    }
  } catch (e: any) {
    console.warn('⚠️ syncLegacyRcoinsToBeans warning:', e.message);
  }
}
