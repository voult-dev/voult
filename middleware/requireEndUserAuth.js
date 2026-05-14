const { ApiError } = require('../utils/apiError');

function appIdFromPayload(payload) {
  if (!payload) return null;
  const raw = payload.appId != null ? payload.appId : payload.app;
  return raw != null ? String(raw) : null;
}

/**
 * Enforces an authenticated end user (after global `verifyEndUserJWT`).
 * Use after `verifyClient` when the route must also match the app embedded in the JWT.
 */
module.exports = function requireEndUserAuth(req, res, next) {
  if (!req.endUser) {
    return next(
      new ApiError(401, 'UNAUTHORIZED', 'Authentication required')
    );
  }

  if (req.appClient && req.tokenPayload) {
    const tokenAppId = appIdFromPayload(req.tokenPayload);
    if (tokenAppId && tokenAppId !== String(req.appClient._id)) {
      return next(
        new ApiError(
          403,
          'TOKEN_APP_MISMATCH',
          'Token does not belong to this application'
        )
      );
    }
  }

  next();
};
