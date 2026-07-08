const mongoose = require('mongoose');

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const WebAuthnChallengeSchema = new mongoose.Schema(
  {
    challenge: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['registration', 'authentication'],
      required: true
    },
    app: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'App',
      required: true
    },
    endUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EndUser',
      default: null
    },
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

WebAuthnChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

WebAuthnChallengeSchema.statics.createChallenge = function createChallenge(payload) {
  return this.create({
    ...payload,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS)
  });
};

module.exports = mongoose.models.WebAuthnChallenge
  || mongoose.model('WebAuthnChallenge', WebAuthnChallengeSchema);
