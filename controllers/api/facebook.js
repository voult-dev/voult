const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const App = require('../../models/app');
const { ApiError } = require('../../utils/apiError');
const { signAccessToken } = require('../../utils/jwt');
const { createRefreshToken } = require('../../utils/refreshToken');
const { getFacebookProfile } = require('../../utils/facebookOAuth');
const { welcomeOAuthUser } = require('../../services/emailService');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

module.exports.facebookRegister = async (req, res) => {
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

  // Look up by email if present, otherwise by facebookId (accounts without email)
  const existingUser = email
    ? await endUserBuilder.findOne({ app: app._id, email, deletedAt: null })
    : await endUserBuilder.findOne({ app: app._id, facebookId, deletedAt: null });

  if (existingUser) {
    if (existingUser.facebookId && existingUser.facebookId === facebookId) {
      // Same person: treat as login
      existingUser.lastLoginAt = new Date();
      await existingUser.save();
      const accessJwt = signAccessToken(existingUser, app);
      const { rawToken: refreshToken } = await createRefreshToken({
        endUser: existingUser,
        app,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
      return res.json({
        message: 'Facebook login successful',
        accessToken: accessJwt,
        refreshToken,
        user: {
          id: existingUser._id,
          email: existingUser.email,
          fullName: existingUser.fullName
        }
      });
    }
    throw new ApiError(
      409,
      'USER_EXISTS',
      'An account with this email already exists'
    );
  }

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

  const accessJwt = signAccessToken(user, app);
  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    message: 'Facebook registration successful',
    accessToken: accessJwt,
    refreshToken,
    user: {
      id: user._id,
      email: user.email || null,
      fullName: user.fullName
    }
  });
};


module.exports.facebookLogin = async (req, res) => {
    const { accessToken } = req.body;
    const app = req.appClient;
  
    if (!accessToken) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'accessToken is required');
    }
  
    const { facebookId, email } =
      await getFacebookProfile(accessToken);
  
    // Find by email if present, otherwise by facebookId (accounts without email)
    const user = email
      ? await endUserBuilder.findOne({ app: app._id, email, deletedAt: null })
      : await endUserBuilder.findOne({ app: app._id, facebookId, deletedAt: null });
  
    if (!user) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        'No account found for this Facebook account'
      );
    }
  
    if (!user.facebookId) {
      user.facebookId = facebookId;
      user.authProvider = 'facebook';
      user.isEmailVerified = true;
    }
  
    if (!user.isActive) {
      throw new ApiError(
        403,
        'ACCOUNT_DISABLED',
        'Account is disabled'
      );
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
      message: 'Facebook login successful',
      accessToken: accessJwt,
      refreshToken,
      user: {
        id: user._id,
        email: user.email || null,
        fullName: user.fullName
      }
    });
  };
  

