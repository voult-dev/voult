const Joi = require('joi');

module.exports.addEntrySchema = Joi.object({
  value: Joi.string().max(64).required(),
  label: Joi.string().max(120).optional().allow(''),
  isAdminBypass: Joi.boolean().optional()
});

module.exports.updateSettingsSchema = Joi.object({
  enabled: Joi.boolean().optional(),
  notifyNewIps: Joi.boolean().optional()
}).min(1);
