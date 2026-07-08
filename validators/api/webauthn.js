const Joi = require('joi');

module.exports.registrationOptionsSchema = Joi.object({
  deviceName: Joi.string().max(100).optional()
});

module.exports.registrationVerifySchema = Joi.object({
  credential: Joi.object().required(),
  deviceName: Joi.string().max(100).optional()
});

module.exports.authenticationOptionsSchema = Joi.object({
  email: Joi.string().email().optional()
});

module.exports.authenticationVerifySchema = Joi.object({
  credential: Joi.object().required()
});

module.exports.updateCredentialSchema = Joi.object({
  deviceName: Joi.string().min(1).max(100).required()
});
