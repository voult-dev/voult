const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const {
  exchangeCodeForToken,
  getGitHubProfile
} = require('../../utils/githubOAuth');
const { issueOAuthTokens } = require('../../utils/issueOAuthTokens');

const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

async function resolveGitHubProfile(req) {
  const { code, redirect_uri: redirectUri, accessToken: bodyAccessToken } = req.body;
  const app = req.appClient;

  let accessToken = bodyAccessToken;

  if (!accessToken) {
    if (!code) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Authorization code or accessToken is required'
      );
    }

    if (
      !app.githubOAuth?.enabled ||
      !app.githubOAuth.clientId ||
      !app.githubOAuth.clientSecret
    ) {
      throw new ApiError(
        400,
        'GITHUB_NOT_CONFIGURED',
        'GitHub OAuth is not fully configured'
      );
    }

    accessToken = await exchangeCodeForToken({
      code,
      clientId: app.githubOAuth.clientId,
      clientSecret: app.githubOAuth.clientSecret,
      redirectUri
    });
  }

  const { githubId, email, name } = await getGitHubProfile(accessToken);

  if (!email) {
    throw new ApiError(400, 'EMAIL_REQUIRED', 'GitHub email not available');
  }

  return { app, githubId, email, name };
}

async function loginExistingGitHubUser(req, res, user, app, githubId) {
  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account disabled');
  }

  if (!user.githubId) {
    user.githubId = githubId;
    user.authProvider = 'github';
  }

  user.lastLoginAt = new Date();
  await user.save();

  await issueOAuthTokens(req, res, user, app, {
    message: 'GitHub login successful',
    status: 200
  });
}

async function registerNewGitHubUser(req, res, app, { githubId, email, name }) {
  const user = await EndUser.create({
    app: app._id,
    email,
    fullName: name,
    githubId,
    authProvider: 'github',
    isEmailVerified: true,
    isActive: true,
    lastLoginAt: new Date()
  });

  await appBuilder.updateOne(
    { _id: app._id },
    { $inc: { 'usage.totalRegistrations': 1 } }
  );

  await welcomeOAuthUser({
    to: user.email,
    name: user.fullName,
    appName: app.name,
    provider: 'GitHub'
  }).catch(err => {
    console.error('Welcome email failed', err.message);
  });

  await issueOAuthTokens(req, res, user, app, {
    message: 'GitHub registration successful',
    status: 201
  });
}

async function handleGitHubAuth(req, res, mode) {
  const { app, githubId, email, name } = await resolveGitHubProfile(req);

  const existingUser = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (mode === 'login') {
    if (!existingUser) {
      throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found');
    }

    return loginExistingGitHubUser(req, res, existingUser, app, githubId);
  }

  if (mode === 'register') {
    if (existingUser) {
      throw new ApiError(409, 'USER_EXISTS', 'Account already exists');
    }

    return registerNewGitHubUser(req, res, app, { githubId, email, name });
  }

  if (existingUser) {
    return loginExistingGitHubUser(req, res, existingUser, app, githubId);
  }

  return registerNewGitHubUser(req, res, app, { githubId, email, name });
}

module.exports.githubRegister = (req, res) => handleGitHubAuth(req, res, 'register');
module.exports.githubLogin = (req, res) => handleGitHubAuth(req, res, 'login');
module.exports.githubAuthenticate = (req, res) => handleGitHubAuth(req, res, 'authenticate');

module.exports.githubProfile = async (req, res) => {
  const user = req.endUser;

  res.json({
    id: user._id,
    githubId: user.githubId || null,
    name: user.fullName,
    email: user.email,
    authProvider: user.authProvider
  });
};
