const express = require('express');
const request = require('supertest');
const {
  createEmailBasedLimiter,
  createIpBasedLimiter
} = require('../../middleware/advancedRateLimiting');

function buildEmailApp(max = 5, windowMs = 60_000) {
  const app = express();
  app.use(express.json());
  const limiter = createEmailBasedLimiter(windowMs, max);
  app.post('/login', limiter, (req, res) => {
    res.status(200).json({ ok: true, email: req.body.email });
  });
  return app;
}

function buildIpApp(max = 10, windowMs = 60_000) {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  const limiter = createIpBasedLimiter(windowMs, max);
  app.post('/action', limiter, (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('advanced rate limiting behavior', () => {
  beforeEach(() => {
    process.env.REDIS_ENABLED = 'false';
    delete process.env.TRUSTED_IPS;
  });

  test('blocks requests after the configured IP limit', async () => {
    const app = buildIpApp(10, 60_000);

    for (let i = 0; i < 10; i += 1) {
      const response = await request(app).post('/action');
      expect(response.status).toBe(200);
    }

    const blocked = await request(app).post('/action');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many requests from this IP/i);
  });

  test('enforces limits independently per email at scale', async () => {
    const app = buildEmailApp(5, 60_000);
    const emailCount = 50;
    const requestsPerEmail = 5;

    const tasks = [];
    for (let e = 0; e < emailCount; e += 1) {
      const email = `user${e}@scale.test`;
      for (let i = 0; i < requestsPerEmail; i += 1) {
        tasks.push(
          request(app)
            .post('/login')
            .send({ email, password: 'Password123!' })
        );
      }
    }

    const responses = await Promise.all(tasks);

    expect(responses.every((res) => res.status === 200)).toBe(true);

    const blocked = await request(app)
      .post('/login')
      .send({ email: 'user0@scale.test', password: 'Password123!' });

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many attempts for this email/i);

    const freshEmailAllowed = await request(app)
      .post('/login')
      .send({ email: 'fresh-user@scale.test', password: 'Password123!' });

    expect(freshEmailAllowed.status).toBe(200);
  });

  test('isolates hot keys without blocking unrelated keys', async () => {
    const app = buildEmailApp(3, 60_000);

    for (let i = 0; i < 3; i += 1) {
      const hot = await request(app)
        .post('/login')
        .send({ email: 'hot@scale.test', password: 'Password123!' });
      expect(hot.status).toBe(200);
    }

    const hotBlocked = await request(app)
      .post('/login')
      .send({ email: 'hot@scale.test', password: 'Password123!' });
    expect(hotBlocked.status).toBe(429);

    const coldAllowed = await request(app)
      .post('/login')
      .send({ email: 'cold@scale.test', password: 'Password123!' });
    expect(coldAllowed.status).toBe(200);
  });

  test('handles concurrent burst on a single key correctly', async () => {
    const app = buildEmailApp(3, 60_000);
    const email = 'burst@scale.test';

    const burst = await Promise.all(
      Array.from({ length: 6 }, () =>
        request(app).post('/login').send({ email, password: 'Password123!' })
      )
    );

    const allowed = burst.filter((res) => res.status === 200);
    const blocked = burst.filter((res) => res.status === 429);

    expect(allowed).toHaveLength(3);
    expect(blocked).toHaveLength(3);
    expect(blocked[0].body.error).toMatch(/Too many attempts for this email/i);
  });
});
