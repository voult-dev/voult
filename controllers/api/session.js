const RefreshToken = require('../../models/refreshToken');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const {ApiError} = require('../../utils/apiError');
const AuditService = require('../../services/auditService');

const { createRefreshToken } = require('../../utils/refreshToken');
const { signAccessToken } = require('../../utils/jwt');

const refreshTokenBuilder = new SafeQueryBuilder(RefreshToken);

// =======================
// LIST SESSIONS
// =======================
module.exports.listSessions = async (req, res) => {
    if (!req.endUser) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
    };
  
    const sessions = await refreshTokenBuilder.find({
      endUser: req.endUser._id,
      app: req.endUser.app,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .sort({ lastUsedAt: -1 })
      .select('-tokenHash -replacedByTokenHash');
  
    res.status(200).json({
      sessions: sessions.map(s => ({
        id: s._id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        lastUsedAt: s.lastUsedAt,
        expiresAt: s.expiresAt,
      })),
    });
  };



  // Revoke Session

  module.exports.revokeSession = async (req, res) => {
    const { sessionId } = req.params;
  
    const session = await refreshTokenBuilder.findOne({
      _id: sessionId,
      endUser: req.endUser._id,
      app: req.endUser.app,
      revokedAt: null,
    });
  
    if (!session) {
      throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');
    }
  
    session.revokedAt = new Date();
    await session.save();

    await AuditService.log('SESSION_REVOKED', req.endUser._id, req.endUser.app, req, {
      details: { sessionId, scope: 'single' }
    });
  
    res.status(200).json({
      message: 'Session revoked successfully',
    });
  };
  

// Refresh Token
// module.exports.refresh = async (req, res) => {
//   const { refreshToken } = req.body;
//   const app = req.endUser.app;

//   if (!refreshToken) {
//     throw new ApiError(400, 'VALIDATION_ERROR', 'Refresh token required');
//   }

//   const tokenHash = RefreshToken.hashToken(refreshToken);

//   const storedToken = await refreshTokenBuilder.findOne({
//     tokenHash,
//   }).populate('endUser');

//   //  Token not found
//   if (!storedToken) {
//     throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
//   }

//   // 🚨 REUSE DETECTION
//   if (storedToken.revokedAt) {
//     // Someone reused an already-rotated token
//     await refreshTokenBuilder.updateMany(
//       {
//         endUser: storedToken.endUser._id,
//         app: storedToken.app,
//         revokedAt: null,
//       },
//       { revokedAt: new Date() }
//     );

//     throw new ApiError(
//       401,
//       'REFRESH_TOKEN_REUSE_DETECTED',
//       'Session compromised. Please log in again.'
//     );
//   }

//   //  Expired
//   if (storedToken.expiresAt < new Date()) {
//     throw new ApiError(
//       401,
//       'REFRESH_TOKEN_EXPIRED',
//       'Refresh token expired'
//     );
//   }

//   //  ROTATION
//   storedToken.revokedAt = new Date();

//   const { rawToken: newRefreshToken } = await createRefreshToken({
//     endUser: storedToken.endUser,
//     app,
//     ipAddress: req.ip,
//     userAgent: req.headers['user-agent'],
//   });

//   storedToken.replacedByTokenHash =
//     RefreshToken.hashToken(newRefreshToken);

//   storedToken.lastUsedAt = new Date();  

//   await storedToken.save();

//   const accessToken = signAccessToken(
//     storedToken.endUser,
//     app
//   );

//   res.json({
//     accessToken,
//     refreshToken: newRefreshToken,
//   });
// };
module.exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Refresh token required');
  }

  const tokenHash = RefreshToken.hashToken(refreshToken);

  const storedToken = await refreshTokenBuilder.findOne({ tokenHash }).populate('endUser');

  if (!storedToken) {
    throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token');
  }

  const appId = storedToken.app;

  // REUSE DETECTION
  if (storedToken.revokedAt) {
    await refreshTokenBuilder.updateMany(
      { endUser: storedToken.endUser._id, app: storedToken.app, revokedAt: null },
      { revokedAt: new Date() }
    );
    await AuditService.log('TOKEN_REVOKED', storedToken.endUser._id, appId, req, {
      details: { reason: 'REFRESH_TOKEN_REUSE_DETECTED' },
      status: 'FAILURE',
      riskLevel: 'CRITICAL'
    });
    throw new ApiError(401, 'REFRESH_TOKEN_REUSE_DETECTED', 'Session compromised. Please log in again.');
  }

  if (storedToken.expiresAt < new Date()) {
    await AuditService.log('SESSION_CREATED', storedToken.endUser._id, appId, req, {
      details: { reason: 'REFRESH_TOKEN_EXPIRED' },
      status: 'FAILURE',
      riskLevel: 'LOW'
    });
    throw new ApiError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token expired');
  }

  // ROTATION
  storedToken.revokedAt = new Date();

  const { rawToken: newRefreshToken } = await createRefreshToken({
    endUser: storedToken.endUser,
    app: storedToken.app,       // use app from the stored token, not req.endUser
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  storedToken.replacedByTokenHash = RefreshToken.hashToken(newRefreshToken);
  storedToken.lastUsedAt = new Date();
  await storedToken.save();

  const accessToken = signAccessToken(storedToken.endUser, storedToken.app);

  await AuditService.log('SESSION_CREATED', storedToken.endUser._id, appId, req, {
    details: { method: 'refresh' }
  });

  res.json({ accessToken, refreshToken: newRefreshToken });
};