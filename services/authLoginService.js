const App = require('../models/app');
const { SafeQueryBuilder } = require('../middleware/queryValidation');
const { signAccessToken, createRefreshToken } = require('../utils/jwt');
const AuditService = require('./auditService');

const appBuilder = new SafeQueryBuilder(App);

async function completeEndUserLogin(req, res, user, app, auditDetails = {}) {
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastLoginAt = new Date();

  const appO = await appBuilder.findById(app._id);
  appO.usage.totalLogins += 1;
  await appO.save();

  const accessToken = signAccessToken(user, app);
  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  await user.save();

  await AuditService.log('LOGIN_SUCCESS', user._id, app._id, req, {
    details: auditDetails
  });

  return res.status(200).json({
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      mfaEnabled: user.mfaEnabled
    }
  });
}

module.exports = {
  completeEndUserLogin
};
