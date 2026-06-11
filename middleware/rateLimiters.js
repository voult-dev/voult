const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

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
  handler: (req, res) => {
    console.warn('[RATE LIMIT] Auth rate limit exceeded for IP:', req.ip, 'path:', req.path);
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
