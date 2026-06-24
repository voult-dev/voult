const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const AppSchema = new mongoose.Schema({
  name: { type: String, required: true },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Developer',
    required: true
  },

  description: String,

  // 🔐 CALLBACK ALLOWLIST
  allowedCallbackUrls: {
    type: [String],
    default: []
  },

  isActive: {
    type: Boolean,
    default: true
  },

  clientId: {
    type: String,
    unique: true,
    index: true
  },

  clientSecretHash: {
    type: String,
    select: false
  },

  usage: {
    totalRegistrations: { type: Number, default: 0 },
    totalLogins: { type: Number, default: 0 }
  },

googleOAuth: {
  enabled: {
    type: Boolean,
    default: false,
  },
  clientId: {
    type: String,
  },
  clientSecret: {
    type: String,
    select: false,
  },
  redirectUri: {
    type: String,
  },

},
githubOAuth: {
    enabled: { 
      type: Boolean, 
      default: false 
    },
    clientId: { 
      type: String 
    },
    clientSecret: { 
      type: String, 
      select: false 
    },
    redirectUri: { 
      type: String 
    }
},

facebookOAuth: {
  enabled: Boolean,
  appId: String,
  appSecret: String,
  redirectUri: String
},

linkedinOAuth :{
  enabled : {
    type : Boolean,
    default : false
  },
  clientId : String,
  clientSecret : {
    type : String,
    select : false
  },
  redirectUri : String
},

appleOAuth : {
  enabled : {
    type : Boolean, 
    default: false
  },
  clientId : String,
  teamId : String,
  keyId : String,
  privateKey : {
    type : String,
    select : false
  },
  redirectUri : String
},

microsoftOAuth : {
  enabled : {
    type : Boolean,
    default: false
  },
  clientId : String,
  clientSecret : {
    type : String,
    select : false
  },
  teamId : {
    type : String,
    default : 'common' // common | organizations | consumers | specific tenant ID
  },
  redirectUri : String
},

  deletedAt: Date
}, { timestamps: true });

/* ================= METHODS ================= */

AppSchema.methods.generateClientId = function () {
  this.clientId = `app_${crypto.randomBytes(12).toString('hex')}`;
  return this.clientId;
};

AppSchema.methods.generateClientSecret = function () {
  const secret = crypto.randomBytes(32).toString('hex');
  this.clientSecretHash = bcrypt.hashSync(secret, 12);
  return secret;
};

AppSchema.methods.verifyClientSecret = async function (clientSecret) {
  console.log('verifyClientSecret called with:', {
    clientSecret,
    hasHash: !!this.clientSecretHash
  });

  // Check if clientSecretHash exists
  if (!this.clientSecretHash) {
    console.error('Client secret hash not found for app:', this.clientId);
    return false;
  }

  // Check if clientSecret is provided
  if (!clientSecret) {
    console.error('Client secret not provided');
    return false;
  }

  try {
    return await bcrypt.compare(clientSecret, this.clientSecretHash);
  } catch (error) {
    console.error('Error comparing client secret:', error.message);
    return false;
  }
};


module.exports = mongoose.models.App || mongoose.model('App', AppSchema);
