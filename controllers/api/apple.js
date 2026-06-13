const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const { signAccessToken } = require('../../utils/jwt');
const { createRefreshToken } = require('../../utils/refreshToken');
const {
  generateAppleClientSecret,
  exchangeAppleCode,
  verifyAppleIdToken
} = require('../../utils/appleOAuth');
const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

module.exports.appleRegister = async (req, res) => {
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

  const { appleId, email, emailVerified } =
    verifyAppleIdToken(idToken);

  if (!email || !emailVerified) {
    throw new ApiError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Apple email not verified'
    );
  }

  const existingUser = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (existingUser) {
    throw new ApiError(409, 'USER_EXISTS');
  }

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

  const accessJwt = signAccessToken(user, app);
  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    message: 'Apple registration successful',
    accessToken: accessJwt,
    refreshToken
  });
};

module.exports.appleLogin = async (req, res) => {
    const { idToken } = req.body;
    const app = req.appClient;
  
    const { appleId, email } =
      verifyAppleIdToken(idToken);
  
    const user = await endUserBuilder.findOne({
      app: app._id,
      email,
      deletedAt: null
    });
  
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND');
    }
  
    if (!user.appleId) {
      user.appleId = appleId;
      user.authProvider = 'apple';
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
      message: 'Apple login successful',
      accessToken: accessJwt,
      refreshToken
    });
  };