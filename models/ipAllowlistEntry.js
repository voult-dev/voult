const mongoose = require('mongoose');

const IpAllowlistEntrySchema = new mongoose.Schema(
  {
    app: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'App',
      required: true,
      index: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    },
    label: {
      type: String,
      default: '',
      maxlength: 120
    },
    isAdminBypass: {
      type: Boolean,
      default: false
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Developer'
    }
  },
  { timestamps: true }
);

IpAllowlistEntrySchema.index({ app: 1, value: 1 }, { unique: true });

module.exports = mongoose.models.IpAllowlistEntry
  || mongoose.model('IpAllowlistEntry', IpAllowlistEntrySchema);
