class MemoryRateLimitStore {
  constructor() {
    this.hits = new Map();
    this.windowMs = 15 * 60 * 1000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  increment(key) {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || entry.resetTime.getTime() <= now) {
      const resetTime = new Date(now + this.windowMs);
      this.hits.set(key, { totalHits: 1, resetTime });
      return { totalHits: 1, resetTime };
    }

    entry.totalHits += 1;
    return { totalHits: entry.totalHits, resetTime: entry.resetTime };
  }

  decrement(key) {
    const entry = this.hits.get(key);
    if (entry && entry.totalHits > 0) {
      entry.totalHits -= 1;
    }
  }

  resetKey(key) {
    this.hits.delete(key);
  }

  resetAll() {
    this.hits.clear();
  }
}

class FailoverRateLimitStore {
  constructor(redisStoreFactory, onFallback) {
    this.redisStoreFactory = redisStoreFactory;
    this.onFallback = onFallback;
    this.memoryStore = new MemoryRateLimitStore();
    this.redisStore = null;
    this.usingRedis = false;
    this.windowMs = 15 * 60 * 1000;
  }

  async init(options) {
    this.windowMs = options.windowMs;
    this.memoryStore.init(options);

    try {
      this.redisStore = this.redisStoreFactory();
      await this.redisStore.init(options);
      this.usingRedis = true;
    } catch (err) {
      this.usingRedis = false;
      this.onFallback(err);
    }
  }

  async increment(key) {
    if (this.usingRedis && this.redisStore) {
      try {
        return await this.redisStore.increment(key);
      } catch (err) {
        this.usingRedis = false;
        this.onFallback(err);
      }
    }

    return this.memoryStore.increment(key);
  }

  async decrement(key) {
    if (this.usingRedis && this.redisStore) {
      try {
        await this.redisStore.decrement(key);
        return;
      } catch (err) {
        this.usingRedis = false;
        this.onFallback(err);
      }
    }

    this.memoryStore.decrement(key);
  }

  async resetKey(key) {
    if (this.usingRedis && this.redisStore) {
      try {
        await this.redisStore.resetKey(key);
      } catch (err) {
        this.usingRedis = false;
        this.onFallback(err);
      }
    }

    this.memoryStore.resetKey(key);
  }

  async resetAll() {
    if (this.usingRedis && this.redisStore) {
      try {
        await this.redisStore.resetAll();
      } catch (err) {
        this.usingRedis = false;
        this.onFallback(err);
      }
    }

    this.memoryStore.resetAll();
  }

  getStatus() {
    return {
      usingRedis: this.usingRedis,
      fallbackActive: !this.usingRedis
    };
  }
}

module.exports = {
  MemoryRateLimitStore,
  FailoverRateLimitStore
};
