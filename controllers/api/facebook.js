const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const { issueOAuthTokens } = require('../../utils/issueOAuthTokens');
const { getFacebookProfile } = require('../../utils/facebookOAuth');
const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

async function resolveFacebookProfile(req) {
  const { accessToken } = req.body;
  const app = req.appClient;

  if (!accessToken) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'accessToken is required');
  }

  if (!app.facebookOAuth?.enabled) {
    throw new ApiError(
      400,
      'FACEBOOK_NOT_ENABLED',
      'Facebook OAuth not enabled'
    );
  }

  const { facebookId, email, fullName } = await getFacebookProfile(accessToken);

  return { app, facebookId, email, fullName };
}

async function findFacebookUser(app, email, facebookId) {
  if (email) {
    return endUserBuilder.findOne({ app: app._id, email, deletedAt: null });
  }

  return endUserBuilder.findOne({ app: app._id, facebookId, deletedAt: null });
}

async function loginExistingFacebookUser(req, res, user, app, facebookId) {
  if (!user.isActive) {
    throw new ApiError(
      403,
      'ACCOUNT_DISABLED',
      'Account is disabled'
    );
  }

  if (!user.facebookId) {
    user.facebookId = facebookId;
    user.authProvider = 'facebook';
    user.isEmailVerified = true;
  }

  user.lastLoginAt = new Date();
  await user.save();

  await issueOAuthTokens(req, res, user, app, {
    message: 'Facebook login successful',
    status: 200,
    userPayload: {
      fullName: user.fullName
    }
  });
}

async function registerNewFacebookUser(req, res, app, { facebookId, email, fullName }) {
  const user = await EndUser.create({
    app: app._id,
    email: email || undefined,
    fullName: fullName || undefined,
    facebookId,
    authProvider: 'facebook',
    isEmailVerified: !!email,
    isActive: true,
    lastLoginAt: new Date()
  });

  await appBuilder.updateOne(
    { _id: app._id },
    { $inc: { 'usage.totalRegistrations': 1 } }
  );

  if (email) {
    await welcomeOAuthUser({
      to: email,
      name: fullName,
      appName: app.name,
      provider: 'Facebook'
    }).catch(err => console.error('Welcome email failed', err.message));
  }

  await issueOAuthTokens(req, res, user, app, {
    message: 'Facebook registration successful',
    status: 201,
    userPayload: {
      fullName: user.fullName
    }
  });
}

async function handleFacebookAuth(req, res, mode) {
  const { app, facebookId, email, fullName } = await resolveFacebookProfile(req);
  const existingUser = await findFacebookUser(app, email, facebookId);

  if (mode === 'login') {
    if (!existingUser) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        'No account found for this Facebook account'
      );
    }

    return loginExistingFacebookUser(req, res, existingUser, app, facebookId);
  }

  if (mode === 'register') {
    if (existingUser) {
      if (existingUser.facebookId && existingUser.facebookId === facebookId) {
        return loginExistingFacebookUser(req, res, existingUser, app, facebookId);
      }

      throw new ApiError(
        409,
        'USER_EXISTS',
        'An account with this email already exists'
      );
    }

    return registerNewFacebookUser(req, res, app, { facebookId, email, fullName });
  }

  if (existingUser) {
    return loginExistingFacebookUser(req, res, existingUser, app, facebookId);
  }

  return registerNewFacebookUser(req, res, app, { facebookId, email, fullName });
}

module.exports.facebookRegister = (req, res) => handleFacebookAuth(req, res, 'register');
module.exports.facebookLogin = (req, res) => handleFacebookAuth(req, res, 'login');
module.exports.facebookAuthenticate = (req, res) => handleFacebookAuth(req, res, 'authenticate');
