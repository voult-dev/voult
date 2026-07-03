const { FailoverRateLimitStore } = require('../../middleware/failoverRateLimitStore');

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
});
