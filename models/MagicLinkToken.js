const mongoose = require('mongoose');
const {Schema} = mongoose;
const crypto = require('crypto');
const { validateMongoQuery, validateMongoUpdate } = require('../middleware/queryValidation');

const magicLinkTokenSchema = new Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  app :{
    type : Schema.Types.ObjectId,
    ref : 'App',
    required : true
  },
  tokenHash: {
    type: String,
    required: true,
    select: false
  },
  expiresAt: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  usedAt: Date,
  redirectUri: {
    type: String,
    required: true
  }
}, { timestamps: true });

// Index for cleanup and lookup
magicLinkTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
magicLinkTokenSchema.index({ email: 1 });

// Static method to hash tokens
magicLinkTokenSchema.statics.hashToken = function(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

// Atomic claim: validates + marks as used in a single DB operation
magicLinkTokenSchema.statics.claimValidToken = async function(rawToken) {
  const tokenHash = this.hashToken(rawToken);

  const now = new Date();

  // findOneAndUpdate is atomic: the first caller wins
  const filter = {
    tokenHash,
    used: false,
    expiresAt: { $gt: now }
  };
  const update = {
    $set: {
      used: true,
      usedAt: now
    }
  };

  validateMongoQuery(filter);
  validateMongoUpdate(update);

  const tokenDoc = await this.findOneAndUpdate(
    filter,
    update,
    {
      new: true
    }
  ).select('+tokenHash');

  if (!tokenDoc) {
    return null;
  }

  return tokenDoc;
};

module.exports = mongoose.models.MagicLinkToken || mongoose.model('MagicLinkToken', magicLinkTokenSchema);
