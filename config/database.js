const mongoose = require('mongoose');

const LEGACY_ENDUSER_INDEXES = ['app_1_username_1', 'app_1_email_1'];

async function syncEndUserIndexes() {
  const EndUser = require('../models/endUser');
  const collection = mongoose.connection.collection('endusers');

  for (const indexName of LEGACY_ENDUSER_INDEXES) {
    try {
      await collection.dropIndex(indexName);
      console.log(`[DATABASE] Dropped legacy EndUser index: ${indexName}`);
    } catch (error) {
      if (error.codeName !== 'IndexNotFound') {
        console.warn(`[DATABASE] Could not drop ${indexName}:`, error.message);
      }
    }
  }

  const nullUsernameResult = await collection.updateMany(
    { username: null },
    { $unset: { username: '' } }
  );
  if (nullUsernameResult.modifiedCount > 0) {
    console.log(
      `[DATABASE] Removed null username from ${nullUsernameResult.modifiedCount} EndUser document(s)`
    );
  }

  await EndUser.syncIndexes();
  console.log('[DATABASE] EndUser indexes synced');
}

const connectDB = async () => {
    console.log('[DATABASE] Connecting to MongoDB...');
    try {
      await mongoose.connect(process.env.DB_URL);
      await syncEndUserIndexes();
    } catch (error) {
      console.error('[DATABASE] Connection ERROR:', error.message);
      console.error('[DATABASE] Check DB_URL in .env file');
      process.exit(1);
    }
  };
  
  module.exports = connectDB;