const EndUser = require('../../models/endUser');
const { ApiError } = require('../../utils/apiError');
const { signAccessToken } = require('../../utils/jwt');
const { createRefreshToken } = require('../../utils/refreshToken');
const { OAuth2Client } = require('google-auth-library');
const fetch = require('node-fetch'); // or global fetch (Node 18+)

const { welcomeOAuthUser } = require('../../services/emailService');
const App = require('../../models/app');

async function getGooglePayload({ idToken, accessToken, clientId }) {
  // -------- 1. Try ID TOKEN (preferred) --------
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
      // If accessToken exists, fallback. Otherwise fail.
      if (!accessToken) {
        throw new ApiError(
          401,
          'INVALID_GOOGLE_TOKEN',
          'Invalid Google ID token'
        );
      }
    }
  }

  // -------- 2. Fallback: ACCESS TOKEN --------
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

  // -------- 3. No credential provided --------
  throw new ApiError(
    400,
    'VALIDATION_ERROR',
    'idToken or accessToken is required'
  );
}

/* =========================================================
   GOOGLE LOGIN
========================================================= */
module.exports.googleLogin = async (req, res) => {
  const { idToken, accessToken } = req.body;
  const app = req.appClient;

  if (!app.googleOAuth?.clientId) {
    throw new ApiError(
      400,
      'GOOGLE_NOT_CONFIGURED',
      'Google login not enabled'
    );
  }

  /* -------- Verify token (id_token or access_token) -------- */
  const payload = await getGooglePayload({
    idToken,
    accessToken,
    clientId: app.googleOAuth.clientId
  });

  const {
    sub: googleId,
    email,
    email_verified
  } = payload;

  if (!email || !email_verified) {
    throw new ApiError(
      403,
      'EMAIL_NOT_VERIFIED',
      'Google email not verified'
    );
  }

  /* -------- Find existing user -------- */
  const user = await EndUser.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (!user) {
    throw new ApiError(
      404,
      'USER_NOT_FOUND',
      'No account found for this email'
    );
  }

  if (!user.isActive) {
    throw new ApiError(
      403,
      'ACCOUNT_DISABLED',
      'Account is disabled'
    );
  }

  /* -------- Link Google if not linked -------- */
  if (!user.googleId) {
    user.googleId = googleId;
    user.authProvider = 'google';
    user.isEmailVerified = true;
  }

  user.lastLoginAt = new Date();
  await user.save();

  /* -------- Issue tokens -------- */
  const accessTokenJwt = signAccessToken(user, app);

  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(200).json({
    message: 'Google login successful',
    accessToken: accessTokenJwt,
    refreshToken,
    user: {
      id: user._id,
      email: user.email
    }
  });
};

/* =========================================================
   GOOGLE REGISTER
========================================================= */
module.exports.googleRegister = async (req, res) => {
  const { idToken, accessToken } = req.body;
  const app = req.appClient;

  if (!app.googleOAuth?.clientId) {
    throw new ApiError(
      400,
      'GOOGLE_NOT_CONFIGURED',
      'Google OAuth not enabled'
    );
  }

  /* -------- Verify token (id_token or access_token) -------- */
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

  /* -------- Build full name safely -------- */
  const fullName =
    (given_name && family_name && `${given_name} ${family_name}`) ||
    name ||
    null;

  /* -------- Prevent duplicates -------- */
  const existingUser = await EndUser.findOne({
    app: app._id,
    email,
    deletedAt: null
  });

  if (existingUser) {
    throw new ApiError(
      409,
      'USER_EXISTS',
      'An account with this email already exists'
    );
  }

  /* -------- Create user -------- */
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

  await App.updateOne(
    { _id: app._id },
    { $inc: { 'usage.totalRegistrations': 1 } }
  );

  /* -------- Send welcome email -------- */
  await welcomeOAuthUser({
    to: email,
    name: fullName,
    appName: app.name,
    provider: 'Google'
  });

  /* -------- Issue tokens -------- */
  const accessTokenJwt = signAccessToken(user, app);

  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(201).json({
    message: 'Google registration successful',
    accessToken: accessTokenJwt,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      fullName: user.fullName
    }
  });
};