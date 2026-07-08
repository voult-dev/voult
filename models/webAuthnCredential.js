const mongoose = require('mongoose');

const WebAuthnCredentialSchema = new mongoose.Schema(
  {
    endUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EndUser',
      required: true,
      index: true
    },
    app: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'App',
      required: true,
      index: true
    },
    credentialId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    publicKey: {
      type: Buffer,
      required: true,
      select: false
    },
    counter: {
      type: Number,
      default: 0
    },
    transports: {
      type: [String],
      default: []
    },
    deviceName: {
      type: String,
      default: 'Passkey',
      maxlength: 100
    },
    aaguid: String,
    credentialDeviceType: {
      type: String,
      enum: ['singleDevice', 'multiDevice'],
      default: 'singleDevice'
    },
    credentialBackedUp: {
      type: Boolean,
      default: false
    },
    webauthnUserId: {
      type: String,
      required: true,
      select: false
    },
    lastUsedAt: Date
  },
  { timestamps: true }
);

WebAuthnCredentialSchema.index({ endUser: 1, app: 1 });

module.exports = mongoose.models.WebAuthnCredential
  || mongoose.model('WebAuthnCredential', WebAuthnCredentialSchema);
