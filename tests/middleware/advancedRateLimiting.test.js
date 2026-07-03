const express = require('express');
const request = require('supertest');
const { ipAuthLimiter } = require('../../middleware/advancedRateLimiting');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/limited', ipAuthLimiter, (req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe('advanced rate limiting behavior', () => {
  test('blocks requests after the configured limit', async () => {
    process.env.REDIS_ENABLED = 'false';
    const app = buildApp();

    for (let i = 0; i < 10; i += 1) {
      const response = await request(app).post('/limited');
      expect(response.status).toBe(200);
    }

    const blocked = await request(app).post('/limited');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/Too many requests from this IP/i);
  });
});
