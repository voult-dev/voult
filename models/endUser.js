const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { Schema } = mongoose;
const crypto = require('crypto');

const EndUserSchema = new Schema(
  {
    app: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'App',
      required: true
    },

    isActive : {
      type : Boolean,
      default : true
    },

    disabledAt : {
      type : Date,
    },

    disabledReason : {
      type : String,
    },

    fullName : {
      type : String,
      trim : true,
      maxlength : 100
    },

    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true
    },

    username: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      maxlength: 30
    },

    passwordHash: {
      type: String,
      select: false
    },

    googleId: {
      type: String,
      index: true
    },

    githubId: {
      type: String,
      index: true
    },

    facebookId: {
      type: String,
      index: true
    },

    authProvider: {
      type: String,
      enum: ['local', 'google', 'github', 'facebook', 'linkedin', 'apple', 'microsoft'],
      default: 'local',
      required : true
    }, 

    isEmailVerified: {
      type: Boolean,
      default: false
    },

    linkedProviders : {
      type : [String],
      enum : ['google', 'github', 'facebook', 'linkedin', 'apple', 'microsoft'],
      default : [],
    },

    emailVerificationToken: String,

    emailVerificationExpires: Date,

    tokenVersion: {
      type: Number,
      default: 0
    },

    resetPasswordToken: {
      type: String,
      select: false
    },
    
    resetPasswordExpires: Date,
    
    lastLoginAt: Date,

    deletedAt: Date,

    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    
    lockUntil: {
      type: Date,
      default: null
    },

    mfaEnabled: {
      type: Boolean,
      default: false
    },

    mfaSecret: {
      type: String,
      select: false
    },

    mfaBackupCodes: {
      type: [String],
      select: false,
      default: []
    },

    mfaEnabledAt: Date,

    mfaPendingSecret: {
      type: String,
      select: false
    },

    mfaPendingBackupCodes: {
      type: [String],
      select: false,
      default: []
    },

    mfaPendingExpires: Date,

    failedMfaAttempts: {
      type: Number,
      default: 0
    },

    mfaLockUntil: {
      type: Date,
      default: null
    }

  },
  { timestamps: true }
);


/* Unique per app when email is a non-empty string (omit field for OAuth-only users without email) */
EndUserSchema.index(
  { app: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $exists: true, $type: 'string', $gt: '' }
    }
  }
);

/* Unique per app when username is set (OAuth users omit username entirely) */
EndUserSchema.index(
  { app: 1, username: 1 },
  {
    unique: true,
    partialFilterExpression: {
      username: { $exists: true, $type: 'string', $gt: '' }
    }
  }
);

/* Password helpers */
EndUserSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 12);
};

EndUserSchema.methods.verifyPassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

/* Email Verification Methods */
EndUserSchema.methods.generateEmailVerificationToken = async function () {
  const rawToken = crypto.randomBytes(32).toString('hex');

  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;

  await this.save(); 

  return rawToken;
};

EndUserSchema.methods.generatePasswordResetToken = function () {
  const rawToken = crypto.randomBytes(32).toString('hex');

  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  this.resetPasswordExpires = Date.now() + 1000 * 60 * 30; // 30 minutes

  return rawToken;
};

EndUserSchema.virtual('isLocked').get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// Helper method to check if a specific provider is linked
EndUserSchema.methods.hasLinkedProvider = function(provider) {
  return this.linkedProviders && this.linkedProviders.includes(provider);
};

// Helper method to get all linked providers
EndUserSchema.methods.getLinkedProviders = function() {
  return this.linkedProviders || [];
};

// Helper method to check if user has any linked providers
EndUserSchema.methods.hasAnyLinkedProviders = function() {
  return this.linkedProviders && this.linkedProviders.length > 0;
};


module.exports = mongoose.models.EndUser || mongoose.model('EndUser', EndUserSchema);
