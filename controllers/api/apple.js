const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const { issueOAuthTokens } = require('../../utils/issueOAuthTokens');
const {
  generateAppleClientSecret,
  exchangeAppleCode,
  verifyAppleIdToken
} = require('../../utils/appleOAuth');
const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

async function resolveAppleProfile(req) {
  const { code, idToken } = req.body;
  const app = req.appClient;

  if (!code || !idToken) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'code and idToken are required');
  }

  if (!app.appleOAuth?.enabled) {
    throw new ApiError(
      400,
      'APPLE_NOT_ENABLED',
      'Apple OAuth not enabled'
    );
  }

  const clientSecret = generateAppleClientSecret({
    clientId: app.appleOAuth.clientId,
    teamId: app.appleOAuth.teamId,
    keyId: app.appleOAuth.keyId,
    privateKey: app.appleOAuth.privateKey
  });

  await exchangeAppleCode({
    code,
    clientId: app.appleOAuth.clientId,
    clientSecret,
    redirectUri: app.appleOAuth.redirectUri
  });

  const { appleId, email, emailVerified } = verifyAppleIdToken(idToken);

  if (!email || !emailVerified) {
    throw new ApiError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Apple email not verified'
    );
  }

  return { app, appleId, email };
}

async function loginExistingAppleUser(req, res, user, app, appleId) {
  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account disabled');
  }

  if (!user.appleId) {
    user.appleId = appleId;
    user.authProvider = 'apple';
  }

  user.lastLoginAt = new Date();
  await user.save();

  await issueOAuthTokens(req, res, user, app, {
    message: 'Apple login successful',
    status: 200
  });
}

async function registerNewAppleUser(req, res, app, { appleId, email }) {
  const user = await EndUser.create({
    app: app._id,
    email,
    appleId,
    authProvider: 'apple',
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
    name: null,
    appName: app.name,
    provider: 'Apple'
  });

  await issueOAuthTokens(req, res, user, app, {
    message: 'Apple registration successful',
    status: 201
  });
}

async function handleAppleAuth(req, res, mode) {
  const { app, appleId, email } = await resolveAppleProfile(req);

  const existingUser = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (mode === 'login') {
    if (!existingUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found');
    }

    return loginExistingAppleUser(req, res, existingUser, app, appleId);
  }

  if (mode === 'register') {
    if (existingUser) {
      throw new ApiError(409, 'USER_EXISTS', 'Account already exists');
    }

    return registerNewAppleUser(req, res, app, { appleId, email });
  }

  if (existingUser) {
    return loginExistingAppleUser(req, res, existingUser, app, appleId);
  }

  return registerNewAppleUser(req, res, app, { appleId, email });
}

module.exports.appleRegister = (req, res) => handleAppleAuth(req, res, 'register');
module.exports.appleLogin = async (req, res) => {
  const { idToken } = req.body;
  const app = req.appClient;

  const { appleId, email } = verifyAppleIdToken(idToken);

  const user = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found');
  }

  return loginExistingAppleUser(req, res, user, app, appleId);
};
module.exports.appleAuthenticate = (req, res) => handleAppleAuth(req, res, 'authenticate');
