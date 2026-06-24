const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
    // Fall back to memory store if Redis unavailable
});

// Per-user rate limiting
const createPerUserLimiter = (windowMs, max, message) => {
    return rateLimit({
        store: new RedisStore({
            client: redisClient,
            prefix: 'rl:' // Rate limit prefix
        }),
        windowMs,
        max,
        message: { error: message },
        keyGenerator: (req) => req.user?._id || req.ip,
        skip: (req) => {
            // Skip rate limiting for trusted IPs
            const trustedIps = (process.env.TRUSTED_IPS || '').split(',');
            return trustedIps.includes(req.ip);
        }
    });
};

// Per-email rate limiting (for login attempts)
const emailBasedLimiter = (windowMs, max) => {
    return rateLimit({
        store: new RedisStore({
            client: redisClient,
            prefix: 'email_rl:'
        }),
        windowMs,
        max,
        message: { error: 'Too many attempts for this email. Try again later.' },
        keyGenerator: (req) => req.body.email || req.ip
    });
};

// Per-IP rate limiting
const ipBasedLimiter = (windowMs, max) => {
    return rateLimit({
        store: new RedisStore({
            client: redisClient,
            prefix: 'ip_rl:'
        }),
        windowMs,
        max,
        keyGenerator: (req) => req.ip
    });
};

module.exports = {
    createPerUserLimiter,
    emailBasedLimiter,
    ipBasedLimiter,
    redisClient
};