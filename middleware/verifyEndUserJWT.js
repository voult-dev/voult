const jwt = require('jsonwebtoken');
const EndUser = require('../models/endUser');
const { SafeQueryBuilder } = require('./queryValidation');

const endUserBuilder = new SafeQueryBuilder(EndUser);

const JWT_SECRET = process.env.ENDUSER_JWT_SECRET;

/**
 * Reads `Authorization: Bearer <token>` first, then legacy `x-client-token: Bearer <token>`.
 */
function getBearerToken(req) {
  const auth = req.headers.authorization;
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const legacy = req.headers['x-client-token'];
  if (legacy && typeof legacy === 'string' && legacy.startsWith('Bearer ')) {
    return legacy.slice(7).trim();
  }
  return null;
}

function appIdFromPayload(payload) {
  if (!payload) return null;
  const raw = payload.appId != null ? payload.appId : payload.app;
  return raw != null ? String(raw) : null;
}

/**
 * Soft JWT identity: parses and verifies when a Bearer token is present, attaches
 * `req.endUser`, `req.user` (safe shape), and `req.tokenPayload`. Never throws;
 * invalid or missing auth continues without attachment.
 */
module.exports.verifyEndUserJWT = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const endUser = await endUserBuilder.findById(payload.sub).select('+linkedProviders');
    
    if (!endUser) {
      return next();
    }

    if (endUser.tokenVersion !== payload.tokenVersion) {
      return next();
    }

    const tokenAppId = appIdFromPayload(payload);

    req.tokenPayload = payload;
    req.appId = tokenAppId || endUser.app;

    req.endUser = endUser;
    req.user = {
      id: endUser._id,
      email: endUser.email,
      username: endUser.username
    };

    next();
  } catch {
    next();
  }
};
