const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const { issueOAuthTokens } = require('../../utils/issueOAuthTokens');
const {
  exchangeCodeForToken,
  getLinkedInProfile
} = require('../../utils/linkedinOAuth');
const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

async function resolveLinkedInProfile(req) {
  const { code } = req.body;
  const app = req.appClient;

  if (!code) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'code is required');
  }

  if (!app.linkedinOAuth?.enabled) {
    throw new ApiError(
      400,
      'LINKEDIN_NOT_ENABLED',
      'LinkedIn OAuth not enabled'
    );
  }

  const accessToken = await exchangeCodeForToken({
    code,
    clientId: app.linkedinOAuth.clientId,
    clientSecret: app.linkedinOAuth.clientSecret,
    redirectUri: app.linkedinOAuth.redirectUri
  });

  const { linkedinId, email, fullName } = await getLinkedInProfile(accessToken);

  return { app, linkedinId, email, fullName };
}

async function loginExistingLinkedInUser(req, res, user, app, linkedinId) {
  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account disabled');
  }

  if (!user.linkedinId) {
    user.linkedinId = linkedinId;
    user.authProvider = 'linkedin';
    user.isEmailVerified = true;
  }

  user.lastLoginAt = new Date();
  await user.save();

  await issueOAuthTokens(req, res, user, app, {
    message: 'LinkedIn login successful',
    status: 200
  });
}

async function registerNewLinkedInUser(req, res, app, { linkedinId, email, fullName }) {
  const user = await EndUser.create({
    app: app._id,
    email,
    fullName,
    linkedinId,
    authProvider: 'linkedin',
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
    provider: 'LinkedIn'
  });

  await issueOAuthTokens(req, res, user, app, {
    message: 'LinkedIn registration successful',
    status: 201,
    userPayload: { fullName }
  });
}

async function handleLinkedInAuth(req, res, mode) {
  const { app, linkedinId, email, fullName } = await resolveLinkedInProfile(req);

  const existingUser = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (mode === 'login') {
    if (!existingUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found');
    }

    return loginExistingLinkedInUser(req, res, existingUser, app, linkedinId);
  }

  if (mode === 'register') {
    if (existingUser) {
      throw new ApiError(
        409,
        'USER_EXISTS',
        'An account with this email already exists'
      );
    }

    return registerNewLinkedInUser(req, res, app, { linkedinId, email, fullName });
  }

  if (existingUser) {
    return loginExistingLinkedInUser(req, res, existingUser, app, linkedinId);
  }

  return registerNewLinkedInUser(req, res, app, { linkedinId, email, fullName });
}

module.exports.linkedinRegister = (req, res) => handleLinkedInAuth(req, res, 'register');
module.exports.linkedinLogin = (req, res) => handleLinkedInAuth(req, res, 'login');
module.exports.linkedinAuthenticate = (req, res) => handleLinkedInAuth(req, res, 'authenticate');
