jest.mock('../../config/database', () => () => Promise.resolve());

const request = require('supertest');
const app = require('../../src/index');

describe('Developer web CSRF protection', () => {
  test('rejects login POST without CSRF token', async () => {
    const agent = request.agent(app);

    await agent.get('/login');

    const res = await agent
      .post('/login')
      .type('form')
      .send({ email: 'test@example.com', password: 'Password123!' });

    expect(res.status).toBe(403);
  });

  test('rejects register POST without CSRF token', async () => {
    const agent = request.agent(app);

    await agent.get('/register');

    const res = await agent
      .post('/register')
      .type('form')
      .send({
        name: 'Test Dev',
        username: 'testdev',
        email: 'dev@example.com',
        password: 'Password123!'
      });

    expect(res.status).toBe(403);
  });

  test('API auth routes do not require CSRF token', async () => {
    const res = await request(app)
      .post('/api/auth/email-login')
      .set('Content-Type', 'application/json')
      .send({ email: 'test@test.com', password: 'Password123!' });

    expect(res.status).not.toBe(403);
    expect(res.body?.error?.code || res.body?.error).toBeDefined();
  });
});

describe('Audit log API authorization', () => {
  test('rejects client-secret-only access to app audit logs', async () => {
    const res = await request(app)
      .get('/api/audit-logs')
      .set('X-Client-Id', 'app_nonexistent')
      .set('X-Client-Secret', 'fake_secret_value');

    expect(res.status).toBe(401);
    expect(res.body.error?.code || res.body.error).toMatch(/DEVELOPER_AUTH_REQUIRED|UNAUTHORIZED|Authentication/i);
  });
});
