const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');
const { FailoverRateLimitStore } = require('./failoverRateLimitStore');

// Redis is opt-in: only connect when REDIS_URL is set or REDIS_ENABLED=true
const REDIS_ENABLED =
  process.env.REDIS_ENABLED === 'true'
  || Boolean((process.env.REDIS_URL || '').trim());

let redisClient = null;
let redisHealthy = false;
let redisFallbackLogged = false;
let redisAbandoned = false;
let redisErrorLogged = false;
const storeStatuses = [];

function buildRedisUrl() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = process.env.REDIS_PORT || 6379;
  return `redis://${host}:${port}`;
}

function logFallback(err) {
  if (!redisFallbackLogged) {
    console.warn('[RATE LIMIT] Redis unavailable, using in-memory store:', err?.message || err);
    redisFallbackLogged = true;
  }
  redisHealthy = false;
}

function abandonRedis(client, reason) {
  if (redisAbandoned) {
    return;
  }

  redisAbandoned = true;
  redisHealthy = false;
  logFallback(reason);

  if (client?.isOpen) {
    client.disconnect().catch(() => {});
  }
}

function createRedisClient() {
  if (!REDIS_ENABLED) {
    return null;
  }

  const client = redis.createClient({
    url: buildRedisUrl(),
    password: process.env.REDIS_PASSWORD || undefined,
    socket: {
      connectTimeout: 3000,
      reconnectStrategy: (retries) => {
        if (retries > 2) {
          abandonRedis(client, 'giving up after repeated connection failures');
          return false;
        }
        return Math.min(retries * 200, 1000);
      }
    }
  });

  client.on('error', (err) => {
    redisHealthy = false;

    if (!redisErrorLogged) {
      redisErrorLogged = true;
      console.error('[RATE LIMIT] Redis error:', err.message || 'connection failed');
    }
  });

  client.on('ready', () => {
    redisHealthy = true;
    redisAbandoned = false;
    redisErrorLogged = false;
    redisFallbackLogged = false;
    console.log('[RATE LIMIT] Redis ready');
  });

  client.connect().catch((err) => {
    abandonRedis(client, err);
  });

  return client;
}

if (REDIS_ENABLED) {
  redisClient = createRedisClient();
}

function createFailoverStore() {
  const store = new FailoverRateLimitStore(
    () => {
      if (!redisClient || !redisHealthy) {
        throw new Error('Redis is not available');
      }

      return new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
        prefix: 'rate_limit:'
      });
    },
    logFallback
  );

  storeStatuses.push(store);
  return store;
}

function createLimiter(options) {
  return rateLimit({
    ...options,
    store: createFailoverStore()
  });
}

const createEmailBasedLimiter = (windowMs, max) => createLimiter({
  windowMs,
  max,
  message: { error: 'Too many attempts for this email. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email || req.body?.username || '';
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    return normalizedEmail ? `email_${normalizedEmail}` : `ip_${ipKeyGenerator(req)}`;
  },
  skip: (req) => {
    const trustedIps = (process.env.TRUSTED_IPS || '').split(',').filter(Boolean);
    return trustedIps.includes(req.ip);
  },
  handler: (req, res) => {
    console.warn('[RATE LIMIT] Email-based limit exceeded', {
      ip: req.ip,
      email: req.body?.email || req.body?.username,
      path: req.path
    });
    res.status(429).json({ error: 'Too many attempts for this email. Please try again later.' });
  }
});

const createIpBasedLimiter = (windowMs, max) => createLimiter({
  windowMs,
  max,
  message: { error: 'Too many requests from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `ip_${ipKeyGenerator(req)}`,
  skip: (req) => {
    const trustedIps = (process.env.TRUSTED_IPS || '').split(',').filter(Boolean);
    return trustedIps.includes(req.ip);
  },
  handler: (req, res) => {
    console.warn('[RATE LIMIT] IP-based limit exceeded', {
      ip: req.ip,
      path: req.path
    });
    res.status(429).json({ error: 'Too many requests from this IP. Please try again later.' });
  }
});

const createPerUserLimiter = (windowMs, max, message) => createLimiter({
  windowMs,
  max,
  message: { error: message },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (
    req.endUser?._id
      ? `user_${req.endUser._id}`
      : req.user?._id
        ? `user_${req.user._id}`
        : `ip_${ipKeyGenerator(req)}`
  ),
  skip: (req) => {
    const trustedIps = (process.env.TRUSTED_IPS || '').split(',').filter(Boolean);
    return trustedIps.includes(req.ip);
  },
  handler: (req, res) => {
    console.warn('[RATE LIMIT] Per-user limit exceeded', {
      ip: req.ip,
      userId: req.endUser?._id || req.user?._id || null,
      path: req.path
    });
    res.status(429).json({ error: message });
  }
});

const emailBasedLimiter = createEmailBasedLimiter(15 * 60 * 1000, 5);
const ipBasedLimiter = createIpBasedLimiter(60 * 60 * 1000, 20);
const emailLoginLimiter = createEmailBasedLimiter(15 * 60 * 1000, 5);
const ipAuthLimiter = createIpBasedLimiter(60 * 60 * 1000, 10);
const mfaVerifyLimiter = createEmailBasedLimiter(15 * 60 * 1000, 10);

function getRedisStatus() {
  return {
    enabled: REDIS_ENABLED,
    healthy: redisHealthy,
    abandoned: redisAbandoned,
    connected: Boolean(redisClient?.isOpen),
    ready: Boolean(redisClient?.isReady),
    stores: storeStatuses.map((store) => store.getStatus())
  };
}

module.exports = {
  createPerUserLimiter,
  createEmailBasedLimiter,
  createIpBasedLimiter,
  emailBasedLimiter,
  ipBasedLimiter,
  emailLoginLimiter,
  ipAuthLimiter,
  mfaVerifyLimiter,
  redisClient,
  getRedisStatus,
  FailoverRateLimitStore
};
