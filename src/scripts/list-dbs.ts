import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

(async () => {
  const uri = process.env.MONGO_URI!;
  console.log('Connecting to:', uri.replace(/:([^@]+)@/, ':****@'));
  
  await mongoose.connect(uri);
  const admin = mongoose.connection.db!.admin();
  
  // List all databases
  const { databases } = await admin.listDatabases();
  console.log('\nAll databases on this cluster:');
  databases.forEach((db: any) => console.log(`  ${db.name}  (${(db.sizeOnDisk / 1024).toFixed(1)} KB)`));

  // Check current db name
  console.log('\nCurrent DB name:', mongoose.connection.db!.databaseName);
  
  // List collections in current db
  const cols = await mongoose.connection.db!.listCollections().toArray();
  console.log('\nCollections in current DB:');
  cols.forEach(c => console.log(`  ${c.name}`));

  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
