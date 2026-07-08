const App = require('../models/app');
const { SafeQueryBuilder } = require('./queryValidation');
const { ApiError } = require('../utils/apiError');

const appBuilder = new SafeQueryBuilder(App);

/**
 * Requires an authenticated developer session and ownership of the app
 * identified by the X-Client-Id header. Does not require client secret.
 */
module.exports = async function requireDeveloperAppOwner(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    throw new ApiError(401, 'DEVELOPER_AUTH_REQUIRED', 'Developer authentication required');
  }

  const clientId = req.headers['x-client-id'];
  if (!clientId) {
    throw new ApiError(401, 'CLIENT_ID_REQUIRED', 'Client ID is required');
  }

  const app = await appBuilder.findOne({
    clientId,
    deletedAt: { $exists: false }
  });

  if (!app || !app.isActive) {
    throw new ApiError(401, 'INVALID_CLIENT', 'Invalid or inactive app');
  }

  if (!app.owner.equals(req.user._id)) {
    throw new ApiError(403, 'APP_ACCESS_DENIED', 'You do not own this application');
  }

  req.appClient = app;
  next();
};
