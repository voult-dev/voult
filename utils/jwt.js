const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Validate JWT secret on module load
if (!process.env.ENDUSER_JWT_SECRET || process.env.ENDUSER_JWT_SECRET.length < 32) {
    throw new Error('ENDUSER_JWT_SECRET must be set and at least 32 characters long');
}

const JWT_SECRET = process.env.ENDUSER_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.NODE_ENV === 'production' ? '15m' : '7d';

// Sign access token with proper configuration
exports.signAccessToken = (user, app) => {
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