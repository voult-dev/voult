const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const { issueOAuthTokens } = require('../../utils/issueOAuthTokens');
const {
  exchangeMicrosoftCode,
  verifyMicrosoftIdToken
} = require('../../utils/microsoftOAuth');
const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

async function resolveMicrosoftProfile(req) {
  const { code } = req.body;
  const app = req.appClient;

  if (!code) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'code is required');
  }

  if (!app.microsoftOAuth?.enabled) {
    throw new ApiError(
      400,
      'MICROSOFT_NOT_ENABLED',
      'Microsoft OAuth not enabled'
    );
  }

  const tokenResponse = await exchangeMicrosoftCode({
    code,
    clientId: app.microsoftOAuth.clientId,
    clientSecret: app.microsoftOAuth.clientSecret,
    redirectUri: app.microsoftOAuth.redirectUri,
    tenantId: app.microsoftOAuth.tenantId || 'common'
  });

  const { microsoftId, email, fullName } = await verifyMicrosoftIdToken(
    tokenResponse.id_token,
    app.microsoftOAuth.tenantId || 'common',
    app.microsoftOAuth.clientId
  );

  if (!email) {
    throw new ApiError(
      403,
      'EMAIL_REQUIRED',
      'Microsoft account must have an email'
    );
  }

  return { app, microsoftId, email, fullName };
}

async function loginExistingMicrosoftUser(req, res, user, app, microsoftId) {
  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account disabled');
  }

  if (!user.microsoftId) {
    user.microsoftId = microsoftId;
    user.authProvider = 'microsoft';
  }

  user.lastLoginAt = new Date();
  await user.save();

  await issueOAuthTokens(req, res, user, app, {
    message: 'Microsoft login successful',
    status: 200
  });
}

async function registerNewMicrosoftUser(req, res, app, { microsoftId, email, fullName }) {
  const user = await EndUser.create({
    app: app._id,
    email,
    fullName,
    microsoftId,
    authProvider: 'microsoft',
    isEmailVerified: true,
    isActive: true,
    lastLoginAt: new Date()
  });

  await appBuilder.updateOne(
    { _id: app._id },
    { $inc: { 'usage.totalRegistrations': 1 } }
  );

  await welcomeOAuthUser({
    to: email,
    name: fullName,
    appName: app.name,
    provider: 'Microsoft'
  });

  await issueOAuthTokens(req, res, user, app, {
    message: 'Microsoft registration successful',
    status: 201
  });
}

async function handleMicrosoftAuth(req, res, mode) {
  const { app, microsoftId, email, fullName } = await resolveMicrosoftProfile(req);

  const existingUser = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (mode === 'login') {
    if (!existingUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found');
    }

    return loginExistingMicrosoftUser(req, res, existingUser, app, microsoftId);
  }

  if (mode === 'register') {
    if (existingUser) {
      throw new ApiError(409, 'USER_EXISTS', 'Account already exists');
    }

    return registerNewMicrosoftUser(req, res, app, { microsoftId, email, fullName });
  }

  if (existingUser) {
    return loginExistingMicrosoftUser(req, res, existingUser, app, microsoftId);
  }

  return registerNewMicrosoftUser(req, res, app, { microsoftId, email, fullName });
}

module.exports.microsoftRegister = (req, res) => handleMicrosoftAuth(req, res, 'register');
module.exports.microsoftLogin = (req, res) => handleMicrosoftAuth(req, res, 'login');
module.exports.microsoftAuthenticate = (req, res) => handleMicrosoftAuth(req, res, 'authenticate');
