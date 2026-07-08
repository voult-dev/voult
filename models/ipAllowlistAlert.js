const mongoose = require('mongoose');

const IpAllowlistAlertSchema = new mongoose.Schema(
  {
    app: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'App',
      required: true,
      index: true
    },
    ipAddress: {
      type: String,
      required: true,
      index: true
    },
    path: String,
    userAgent: String,
    attemptCount: {
      type: Number,
      default: 1
    },
    blocked: {
      type: Boolean,
      default: true
    },
    acknowledged: {
      type: Boolean,
      default: false
    },
    notifiedAt: Date,
    firstSeenAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

IpAllowlistAlertSchema.index({ app: 1, ipAddress: 1 }, { unique: true });

module.exports = mongoose.models.IpAllowlistAlert
  || mongoose.model('IpAllowlistAlert', IpAllowlistAlertSchema);
