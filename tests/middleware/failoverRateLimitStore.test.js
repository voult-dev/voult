const { FailoverRateLimitStore, MemoryRateLimitStore } = require('../../middleware/failoverRateLimitStore');

describe('FailoverRateLimitStore', () => {
  test('falls back to memory when redis store fails', async () => {
    const onFallback = jest.fn();
    const store = new FailoverRateLimitStore(
      () => {
        throw new Error('Redis unavailable');
      },
      onFallback
    );

    await store.init({ windowMs: 1000 });

    const first = await store.increment('test-key');
    const second = await store.increment('test-key');

    expect(onFallback).toHaveBeenCalled();
    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(store.getStatus().fallbackActive).toBe(true);
  });

  test('uses redis store when available', async () => {
    const redisStore = {
      init: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue({ totalHits: 3, resetTime: new Date() }),
      decrement: jest.fn(),
      resetKey: jest.fn(),
      resetAll: jest.fn()
    };

    const store = new FailoverRateLimitStore(() => redisStore, jest.fn());
    await store.init({ windowMs: 1000 });

    const result = await store.increment('redis-key');

    expect(redisStore.increment).toHaveBeenCalledWith('redis-key');
    expect(result.totalHits).toBe(3);
    expect(store.getStatus().usingRedis).toBe(true);
  });

  test('switches to memory after redis increment error', async () => {
    const redisStore = {
      init: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockRejectedValue(new Error('connection lost')),
      decrement: jest.fn(),
      resetKey: jest.fn(),
      resetAll: jest.fn()
    };

    const onFallback = jest.fn();
    const store = new FailoverRateLimitStore(() => redisStore, onFallback);
    await store.init({ windowMs: 1000 });

    const result = await store.increment('fallback-key');

    expect(onFallback).toHaveBeenCalled();
    expect(result.totalHits).toBe(1);
    expect(store.getStatus().fallbackActive).toBe(true);
  });

  test('continues serving from memory after failover under concurrent load', async () => {
    const redisStore = {
      init: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockRejectedValue(new Error('connection lost')),
      decrement: jest.fn(),
      resetKey: jest.fn(),
      resetAll: jest.fn()
    };

    const store = new FailoverRateLimitStore(() => redisStore, jest.fn());
    await store.init({ windowMs: 60_000 });

    const results = await Promise.all(
      Array.from({ length: 100 }, (_, index) => store.increment(`key-${index % 10}`))
    );

    expect(store.getStatus().fallbackActive).toBe(true);
    expect(results).toHaveLength(100);

    const keyZeroHits = results
      .filter((_, index) => index % 10 === 0)
      .map((entry) => entry.totalHits);

    expect(Math.max(...keyZeroHits)).toBe(10);
  });

  test('keeps independent counters per key in memory fallback', async () => {
    const store = new FailoverRateLimitStore(() => {
      throw new Error('Redis unavailable');
    }, jest.fn());

    await store.init({ windowMs: 60_000 });

    const keyAFirst = await store.increment('tenant-a');
    const keyBFirst = await store.increment('tenant-b');
    const keyASecond = await store.increment('tenant-a');

    expect(keyAFirst.totalHits).toBe(1);
    expect(keyBFirst.totalHits).toBe(1);
    expect(keyASecond.totalHits).toBe(2);
  });

  test('resetKey and resetAll work in fallback mode', async () => {
    const store = new FailoverRateLimitStore(() => {
      throw new Error('Redis unavailable');
    }, jest.fn());

    await store.init({ windowMs: 60_000 });

    await store.increment('reset-me');
    await store.increment('reset-me');
    await store.resetKey('reset-me');

    const afterReset = await store.increment('reset-me');
    expect(afterReset.totalHits).toBe(1);

    await store.increment('other');
    await store.resetAll();

    const fresh = await store.increment('other');
    expect(fresh.totalHits).toBe(1);
  });
});

describe('MemoryRateLimitStore', () => {
  test('resets window after expiry', async () => {
    jest.useFakeTimers();

    const store = new MemoryRateLimitStore();
    await store.init({ windowMs: 1000 });

    const first = await store.increment('expiring-key');
    expect(first.totalHits).toBe(1);

    jest.advanceTimersByTime(1001);

    const afterExpiry = await store.increment('expiring-key');
    expect(afterExpiry.totalHits).toBe(1);

    jest.useRealTimers();
  });
});
