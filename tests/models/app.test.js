const App = require('../../models/app');
const bcrypt = require('bcrypt');

describe('App.verifyClientSecret', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  test('does not log the client secret', async () => {
    const secret = 'supersecretclientkey1234567890abcdef';
    const app = new App({
      name: 'Test App',
      owner: '507f1f77bcf86cd799439011',
      clientId: 'app_test123'
    });
    app.clientSecretHash = bcrypt.hashSync(secret, 4);

    const result = await app.verifyClientSecret(secret);

    expect(result).toBe(true);
    const allLogOutput = [
      ...consoleLogSpy.mock.calls.flat(),
      ...consoleErrorSpy.mock.calls.flat()
    ].join(' ');
    expect(allLogOutput).not.toContain(secret);
  });

  test('returns false when secret is missing', async () => {
    const app = new App({
      name: 'Test App',
      owner: '507f1f77bcf86cd799439011',
      clientId: 'app_test456'
    });
    app.clientSecretHash = bcrypt.hashSync('secret', 4);

    expect(await app.verifyClientSecret(null)).toBe(false);
    expect(await app.verifyClientSecret('')).toBe(false);
  });
});
