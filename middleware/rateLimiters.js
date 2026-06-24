const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const AuditService = require('../services/auditService');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req),
  handler: (req, res) => {
    console.warn('[RATE LIMIT] API rate limit exceeded for IP:', req.ip);
    res.status(429).json({ error: 'Rate limit exceeded. Too many requests.' });
  }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many attempts. Try again later.' },
  keyGenerator: (req) => ipKeyGenerator(req),
  handler: async (req, res) => {
    console.warn('[RATE LIMIT] Auth rate limit exceeded for IP:', req.ip, 'path:', req.path);

    if (req.appClient?._id) {
      await AuditService.log('LOGIN_ATTEMPT_THROTTLED', null, req.appClient._id, req, {
        details: {
          path: req.path,
          email: req.body?.email,
          username: req.body?.username
        },
        status: 'FAILURE',
        riskLevel: 'MEDIUM'
      });
    }

    res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
});

const webAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => ipKeyGenerator(req),
  handler: (req, res) => {
    console.warn('[RATE LIMIT] Web auth rate limit exceeded for IP:', req.ip, 'path:', req.path);
    res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  webAuthLimiter,
};
