const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const {
  exchangeCodeForToken,
  getGitHubProfile
} = require('../../utils/githubOAuth');
const { signAccessToken } = require('../../utils/jwt');
const { createRefreshToken } = require('../../utils/refreshToken');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

// Email Services
const {welcomeOAuthUser} = require('../../services/emailService');

module.exports.githubRegister = async (req, res) => {
  const { code, redirect_uri: redirectUri } = req.body;
  const app = req.appClient;

  if (!code) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Authorization code required');
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

  const accessToken = await exchangeCodeForToken({
    code,
    clientId: app.githubOAuth.clientId,
    clientSecret: app.githubOAuth.clientSecret,
    redirectUri
  });

  const { githubId, email, name } = await getGitHubProfile(accessToken);

  if (!email) {
    throw new ApiError(400, 'EMAIL_REQUIRED', 'GitHub email not available');
  }

  const existingUser = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (existingUser) {
    throw new ApiError(409, 'USER_EXISTS', 'Account already exists');
  }

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

  // Send Welcome Email
  await welcomeOAuthUser({
    to: user.email,
    name: user.fullName,
    appName: app.name,
    provider: 'GitHub'
  }).catch(err => {
    console.error('Welcome email failed', err.message);
  });

  const accessJwt = signAccessToken(user, app);

  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    message: 'GitHub registration successful',
    accessToken: accessJwt,
    refreshToken,
    user: {
      id: user._id,
      email: user.email
    }
  });
};


module.exports.githubLogin = async (req, res) => {
  const { code, redirect_uri: redirectUri } = req.body;
  const app = req.appClient;

  if (!code) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Authorization code required');
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

  const accessToken = await exchangeCodeForToken({
    code,
    clientId: app.githubOAuth.clientId,
    clientSecret: app.githubOAuth.clientSecret,
    redirectUri
  });

  const { githubId, email } = await getGitHubProfile(accessToken);

  if (!email) {
    throw new ApiError(400, 'EMAIL_REQUIRED', 'GitHub email not available');
  }

  const user = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Account not found');
  }

  if (!user.githubId) {
    user.githubId = githubId;
    user.authProvider = 'github';
  }

  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account disabled');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessJwt = signAccessToken(user, app);

  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.json({
    message: 'GitHub login successful',
    accessToken: accessJwt,
    refreshToken,
    user: {
      id: user._id,
      email: user.email
    }
  });
};


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