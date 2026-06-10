const { ApiError } = require('../utils/apiError');
const EndUser = require('../models/endUser');

module.exports = async function requireEndUserAuth(req, res, next) {
  const decoded = req.tokenPayload;

  if (!decoded) {
    return next(
      new ApiError(401, 'UNAUTHORIZED', 'Authentication required')
    );
  }

  const user = await EndUser.findById(decoded.id);

  if (!user || !user.isActive) {
    return next(
      new ApiError(
        401,
        'ACCOUNT_DISABLED',
        'Account is disabled or no longer exists'
      )
    );
  }

  req.user = user;
  next();
};
