const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Create Redis client with error handling
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || null,
  // Enable auto retry for resilience
  retryStrategy: (times) => {
    // Retry after increasing delays up to a max of 10 seconds
    return Math.min(times * 50, 10000);
  }
});

// Handle Redis connection events
redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
  // We'll fall back to memory store if Redis fails
});

redisClient.on('connect', () => {
  console.log('Connected to Redis for rate limiting');
});

redisClient.on('ready', () => {
  console.log('Redis ready for rate limiting');
});

redisClient.on('reconnecting', () => {
  console.log('Reconnecting to Redis for rate limiting...');
});

// Helper function to check if Redis is available
const isRedisAvailable = () => {
  return redisClient.isOpen && redisClient.isReady;
};

// Fallback to memory store if Redis is not available
const getStore = () => {
  if (isRedisAvailable()) {
    return new RedisStore({
      client: redisClient,
      prefix: 'rate_limit:' // Prefix for all rate limit keys in Redis
    });
  }
  // Return undefined to use memory store (default behavior of rate-limit)
  return undefined;
};

// Per-user rate limiting (uses user ID if available, falls back to IP)
const createPerUserLimiter = (windowMs, max, message) => {
  return rateLimit({
    store: getStore(),
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,  // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
      // Use user ID if available (from authentication), otherwise fall back to IP
      return (req.user && req.user._id) ? `user_${req.user._id}` : `ip_${req.ip}`;
    },
    skip: (req) => {
      // Skip rate limiting for trusted IPs (if configured)
      const trustedIps = (process.env.TRUSTED_IPS || '').split(',').filter(Boolean);
      return trustedIps.includes(req.ip);
    },
    handler: (req, res) => {
      // Log rate limit violation for security monitoring
      console.warn(`[RATE LIMIT] Per-user limit exceeded for key: ${req.key}`, {
        ip: req.ip,
        userId: req.user ? req.user._id : null,
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({ 
        error: message,
        // Optional: include retry-after header value in response body for client handling
        // Note: The standardHeaders option already adds Retry-After header
      });
    }
  });
};

// Per-email rate limiting (for login, password reset, etc. - uses email from request body)
const emailBasedLimiter = (windowMs, max) => {
  return rateLimit({
    store: getStore(),
    windowMs,
    max,
    message: { error: 'Too many attempts for this email. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Extract email from request body (common in auth endpoints)
      const email = req.body?.email || req.body?.username || '';
      // Normalize email to lowercase for consistent keying
      const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
      // If no email found, fall back to IP to prevent bypass
      return normalizedEmail ? `email_${normalizedEmail}` : `ip_${req.ip}`;
    },
    skip: (req) => {
      // Skip rate limiting for trusted IPs
      const trustedIps = (process.env.TRUSTED_IPS || '').split(',').filter(Boolean);
      return trustedIps.includes(req.ip);
    },
    handler: (req, res) => {
      console.warn(`[RATE LIMIT] Email-based limit exceeded`, {
        ip: req.ip,
        email: req.body?.email || req.body?.username,
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({ 
        error: 'Too many attempts for this email. Please try again later.'
      });
    }
  });
};

// Per-IP rate limiting (general purpose)
const ipBasedLimiter = (windowMs, max) => {
  return rateLimit({
    store: getStore(),
    windowMs,
    max,
    message: { error: 'Too many requests from this IP. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `ip_${req.ip}`,
    skip: (req) => {
      // Skip rate limiting for trusted IPs
      const trustedIps = (process.env.TRUSTED_IPS || '').split(',').filter(Boolean);
      return trustedIps.includes(req.ip);
    },
    handler: (req, res) => {
      console.warn(`[RATE LIMIT] IP-based limit exceeded`, {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({ 
        error: 'Too many requests from this IP. Please try again later.'
      });
    }
  });
};

// Export the limiter functions and Redis client for potential external use
module.exports = {
  createPerUserLimiter,
  emailBasedLimiter,
  ipBasedLimiter,
  redisClient
};