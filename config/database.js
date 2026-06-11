const mongoose = require('mongoose');

const connectDB = async () => {
    console.log('[DATABASE] Connecting to MongoDB...');
    try {
      await mongoose.connect(process.env.DB_URL);
      console.log('[DATABASE] Connected successfully');
    } catch (error) {
      console.error('[DATABASE] Connection ERROR:', error.message);
      console.error('[DATABASE] Check DB_URL in .env file');
      process.exit(1);
    }
  };
    
  module.exports = connectDB;