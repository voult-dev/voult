const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const { ApiError } = require('../../utils/apiError');
const { issueOAuthTokens } = require('../../utils/issueOAuthTokens');
const { OAuth2Client } = require('google-auth-library');

const { welcomeOAuthUser } = require('../../services/emailService');
const App = require('../../models/app');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);

async function getGooglePayload({ idToken, accessToken, clientId }) {
  if (idToken) {
    const client = new OAuth2Client(clientId);

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId
      });

      return {
        ...ticket.getPayload(),
        _tokenType: 'id_token'
      };
    } catch {
      if (!accessToken) {
        throw new ApiError(
          401,
          'INVALID_GOOGLE_TOKEN',
          'Invalid Google ID token'
        );
      }
    }
  }

  if (accessToken) {
    const res = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!res.ok) {
      throw new ApiError(
        401,
        'INVALID_GOOGLE_TOKEN',
        'Invalid Google access token'
      );
    }

    const data = await res.json();

    return {
      sub: data.sub,
      email: data.email,
      email_verified: data.email_verified,
      name: data.name,
      given_name: data.given_name,
      family_name: data.family_name,
      _tokenType: 'access_token'
    };
  }

  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    'idToken or accessToken is required'
  );
}

async function loginExistingGoogleUser(req, res, user, app, googleId) {
  if (!user.isActive) {
    throw new ApiError(
      403,
      'ACCOUNT_DISABLED',
      'Account is disabled'
    );
  }

  if (!user.googleId) {
    user.googleId = googleId;
    user.authProvider = 'google';
    user.isEmailVerified = true;
  }

  user.lastLoginAt = new Date();
  await user.save();

  await issueOAuthTokens(req, res, user, app, {
    message: 'Google login successful',
    status: 200
  });
}

async function registerNewGoogleUser(req, res, app, { googleId, email, fullName }) {
  const user = await EndUser.create({
    app: app._id,
    email,
    fullName,
    googleId,
    authProvider: 'google',
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
    provider: 'Google'
  });

  await issueOAuthTokens(req, res, user, app, {
    message: 'Google registration successful',
    status: 201,
    userPayload: { fullName: user.fullName }
  });
}

async function handleGoogleAuth(req, res, mode) {
  const { idToken, accessToken } = req.body;
  const app = req.appClient;

  if (!app.googleOAuth?.clientId) {
    throw new ApiError(
      400,
      'GOOGLE_NOT_CONFIGURED',
      mode === 'register'
        ? 'Google OAuth not enabled'
        : 'Google login not enabled'
    );
  }

  const payload = await getGooglePayload({
    idToken,
    accessToken,
    clientId: app.googleOAuth.clientId
  });

  const {
    sub: googleId,
    email,
    email_verified,
    name,
    given_name,
    family_name
  } = payload;

  if (!email || !email_verified) {
    throw new ApiError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Google email not verified'
    );
  }

  const fullName =
    (given_name && family_name && `${given_name} ${family_name}`) ||
    name ||
    null;

  const existingUser = await endUserBuilder.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (mode === 'login') {
    if (!existingUser) {
      throw new ApiError(
        404,
        'USER_NOT_FOUND',
        'No account found for this email'
      );
    }

    return loginExistingGoogleUser(req, res, existingUser, app, googleId);
  }

  if (mode === 'register') {
    if (existingUser) {
      throw new ApiError(
        409,
        'USER_EXISTS',
        'An account with this email already exists'
      );
    }

    return registerNewGoogleUser(req, res, app, { googleId, email, fullName });
  }

  if (existingUser) {
    return loginExistingGoogleUser(req, res, existingUser, app, googleId);
  }

  return registerNewGoogleUser(req, res, app, { googleId, email, fullName });
}

module.exports.googleLogin = (req, res) => handleGoogleAuth(req, res, 'login');
module.exports.googleRegister = (req, res) => handleGoogleAuth(req, res, 'register');
module.exports.googleAuthenticate = (req, res) => handleGoogleAuth(req, res, 'authenticate');
