const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { SafeQueryBuilder } = require('../middleware/queryValidation');

// Load environment variables
dotenv.config();

// Import models
const App = require('../models/app');
const appBuilder = new SafeQueryBuilder(App);

async function fixClientSecrets() {
  try {
    // Connect to database
    await mongoose.connect(process.env.DB_URL);
    console.log('Connected to database');

    // Find apps that don't have clientSecretHash
    const appsWithoutHash = await appBuilder.find({
      clientSecretHash: { $exists: false }
    });

    console.log(`Found ${appsWithoutHash.length} apps without clientSecretHash`);

    for (const app of appsWithoutHash) {
      console.log(`Fixing app: ${app.name} (${app.clientId})`);
      
      // Generate a new client secret and hash
      const newSecret = app.generateClientSecret();
      await app.save();
      
      console.log(`Generated new client secret for ${app.name}: ${newSecret}`);
      console.log(`Client secret hash: ${app.clientSecretHash}`);
    }

    console.log('All apps have been updated with clientSecretHash');
    
  } catch (error) {
    console.error('Error fixing client secrets:', error);
  } finally {
    mongoose.disconnect();
  }
}

// Run the script
fixClientSecrets();