const Joi = require('joi');

function mfaStepUpTokenSchema(field = 'mfaToken') {
  return Joi.string()
    .required()
    .custom((value, helpers) => {
      const stripped = String(value).trim().replace(/\s+/g, '');

      if (/^\d{6}$/.test(stripped)) {
        return stripped;
      }

      if (/^[A-Fa-f0-9]{8}$/.test(stripped)) {
        return stripped.toUpperCase();
      }

      return helpers.error('any.invalid');
    })
    .messages({
      'any.invalid': `${field} must be a 6-digit authenticator code or 8-character backup code`,
    });
}

module.exports.mfaTokenSchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
});

module.exports.enableMfaSchema = module.exports.mfaTokenSchema;

module.exports.verifyMfaLoginSchema = Joi.object({
  mfaPendingToken: Joi.string().required(),
  mfaToken: mfaStepUpTokenSchema('mfaToken'),
});

module.exports.disableMfaSchema = Joi.object({
  password: Joi.string().allow('').optional(),
  mfaToken: mfaStepUpTokenSchema('mfaToken'),
});

module.exports.regenerateBackupCodesSchema = module.exports.mfaTokenSchema;
