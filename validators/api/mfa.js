const Joi = require('joi');

module.exports.mfaTokenSchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required()
});

module.exports.enableMfaSchema = module.exports.mfaTokenSchema;

module.exports.verifyMfaLoginSchema = Joi.object({
  mfaPendingToken: Joi.string().required(),
  mfaToken: Joi.string().min(6).max(16).required()
});

module.exports.disableMfaSchema = Joi.object({
  password: Joi.string().required(),
  mfaToken: Joi.string().min(6).max(16).required()
});

module.exports.regenerateBackupCodesSchema = module.exports.mfaTokenSchema;
