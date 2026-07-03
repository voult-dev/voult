const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Validate JWT secret on module load
if (!process.env.ENDUSER_JWT_SECRET || process.env.ENDUSER_JWT_SECRET.length < 32) {
    console.error('[JWT INIT ERROR] ENDUSER_JWT_SECRET is missing or too short (min 32 chars)');
    throw new Error('ENDUSER_JWT_SECRET must be set and at least 32 characters long');
}

const JWT_SECRET = process.env.ENDUSER_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.NODE_ENV === 'production' ? '15m' : '7d';

// Sign access token with proper configuration
exports.signAccessToken = (user, app) => {
    console.log('[JWT] signAccessToken called for user:', user?.email || user?._id);
    return jwt.sign(
        {
            sub: user._id,
            appId: app._id,
            tokenVersion: user.tokenVersion,
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN,
            algorithm: 'HS256',
            issuer: 'voult.dev',
            audience: app._id.toString()
        }
    );
};

// Verify token with strict validation
exports.verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'voult.dev'
        });
    } catch (err) {
        console.error('[JWT] verifyAccessToken failed:', err.message);
        if (err.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        }
        if (err.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        throw err;
    }
};

// Generate cryptographically secure refresh token
exports.signRefreshToken = () => {
    return crypto.randomBytes(64).toString('hex');
};

exports.signEndUserToken = (user, app) => {
    console.log('[JWT] signEndUserToken called for user:', user?.email || user?._id);
    return jwt.sign(
      {
        sub: user._id,
        appId: app._id,
        email: user.email,
        username: user.username,
        tokenVersion: user.tokenVersion,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
        algorithm: 'HS256',
      }
    );
};

exports.signMfaPendingToken = (user, app) => {
    return jwt.sign(
      {
        sub: user._id,
        appId: app._id,
        tokenVersion: user.tokenVersion,
        purpose: 'mfa_pending'
      },
      JWT_SECRET,
      {
        expiresIn: '5m',
        algorithm: 'HS256',
        issuer: 'voult.dev',
        audience: app._id.toString()
      }
    );
};

exports.verifyMfaPendingToken = (token, app) => {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'voult.dev',
      audience: app._id.toString()
    });

    if (decoded.purpose !== 'mfa_pending') {
      throw new Error('Invalid MFA pending token');
    }

    return decoded;
};

// Re-export createRefreshToken for convenience
const { createRefreshToken: _createRefreshToken } = require('./refreshToken');
exports.createRefreshToken = _createRefreshToken;