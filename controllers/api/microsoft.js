const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const { signAccessToken } = require('../../utils/jwt');
const { createRefreshToken } = require('../../utils/refreshToken');
const {
  exchangeMicrosoftCode,
  verifyMicrosoftIdToken
} = require('../../utils/microsoftOAuth');
const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

module.exports.microsoftRegister = async (req, res) => {
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

  const { microsoftId, email, fullName } =
    await verifyMicrosoftIdToken(
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

  const accessJwt = signAccessToken(user, app);
  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    message: 'Microsoft registration successful',
    accessToken: accessJwt,
    refreshToken
  });
};

module.exports.microsoftLogin = async (req, res) => {
    const { code } = req.body;
    const app = req.appClient;
  
    const tokenResponse = await exchangeMicrosoftCode({
      code,
      clientId: app.microsoftOAuth.clientId,
      clientSecret: app.microsoftOAuth.clientSecret,
      redirectUri: app.microsoftOAuth.redirectUri,
      tenantId: app.microsoftOAuth.tenantId || 'common'
    });
  
    const { microsoftId, email } =
      await verifyMicrosoftIdToken(
        tokenResponse.id_token,
        app.microsoftOAuth.tenantId || 'common',
        app.microsoftOAuth.clientId
      );
  
    const user = await endUserBuilder.findOne({
      app: app._id,
      email,
      deletedAt: null
    });
  
    if (!user) {
      throw new ApiError(404, 'USER_NOT_FOUND');
    }
  
    if (!user.microsoftId) {
      user.microsoftId = microsoftId;
      user.authProvider = 'microsoft';
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
      message: 'Microsoft login successful',
      accessToken: accessJwt,
      refreshToken
    });
  };