const { signAccessToken } = require('./jwt');
const { createRefreshToken } = require('./refreshToken');

async function issueOAuthTokens(req, res, user, app, { message, status = 200, userPayload = {} }) {
  const accessTokenJwt = signAccessToken(user, app);

  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.status(status).json({
    message,
    accessToken: accessTokenJwt,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      ...userPayload
    }
  });
}

module.exports = { issueOAuthTokens };
