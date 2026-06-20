const App = require('../models/app')
const { SafeQueryBuilder } = require('./queryValidation');
const { ApiError } = require('../utils/apiError');

const appBuilder = new SafeQueryBuilder(App);

module.exports.verifyClient = async (req, res, next) => {
  const clientId = req.headers['x-client-id'];
  const clientSecret = req.headers['x-client-secret'];

  console.log('[VERIFY CLIENT] Request from clientId:', clientId);

  if (!clientId) {
    console.error('[VERIFY CLIENT] ERROR: Client ID is missing');
    throw new ApiError(401, 'CLIENT_ID_REQUIRED', 'Client ID is required');
  }

  const app = await appBuilder.findOne({
    clientId,
    deletedAt: { $exists: false }
  }).select('+clientSecretHash');

  if (!app || !app.isActive) {
    console.error('[VERIFY CLIENT] ERROR: App not found or inactive for clientId:', clientId);
    throw new ApiError(401, 'INVALID_CLIENT', 'Invalid or inactive app');
  }
  
  // 🔑 Only require client secret for NON-OAUTH routes
  const isOAuthRoute =
    req.path.includes('/google/login') ||
    req.path.includes('/google/register') ||
    req.path.includes('/linkedin/login') ||
    req.path.includes('/linkedin/register');
  
  if (!isOAuthRoute) {
    if (!clientSecret) {
      console.error('[VERIFY CLIENT] ERROR: Client secret is missing for route:', req.path);
      throw new ApiError(
        401,
        'CLIENT_SECRET_REQUIRED',
        'Client secret is required'
      );
    }

    const isValid = await app.verifyClientSecret(clientSecret);
    if (!isValid) {
      console.error('[VERIFY CLIENT] ERROR: Invalid client secret for clientId:', clientId);
      throw new ApiError(401, 'INVALID_CLIENT_SECRET', 'Invalid client secret');
    }
  }

  req.appClient = app;
  console.log('[VERIFY CLIENT] SUCCESS: Verified app:', app.clientId);
  next();
};

module.exports.verifyClientIdOnly = async (req, res, next) => {
  const clientId = req.headers['x-client-id'];

  if (!clientId) {
    throw new ApiError(401, 'CLIENT_ID_REQUIRED', 'Client ID is required');
  }

  const app = await appBuilder.findOne({ clientId });

  if (!app || !app.isActive) {
    throw new ApiError(401, 'INVALID_CLIENT', 'Invalid or inactive app');
  }

  req.appClient = app;
  next();
};
