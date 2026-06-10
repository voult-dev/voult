const { ApiError } = require('../utils/apiError');

// This validator uses dynamic property access - property is validated internally by Joi
/* eslint-disable security/detect-object-injection */

module.exports.validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const message = error.details.map(d => d.message).join(', ');

      if (req.originalUrl.startsWith('/api')) {
        return next(
          new ApiError(400, 'VALIDATION_ERROR', message)
        );
      }

      req.flash('error', message);
      return res.redirect('back');
    }

    req[property] = value;
    next();
  };
};
