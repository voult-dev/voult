const WebAuthnService = require('../../services/webAuthnService');

describe('WebAuthnService configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BASE_URL = 'https://app.voult.dev';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('getConfig derives rpID and origin from BASE_URL', () => {
    const config = WebAuthnService.getConfig('My SaaS App');

    expect(config.rpID).toBe('app.voult.dev');
    expect(config.origin).toBe('https://app.voult.dev');
    expect(config.rpName).toBe('My SaaS App');
  });

  test('getConfig respects WEBAUTHN_RP_ID and WEBAUTHN_ORIGIN overrides', () => {
    process.env.WEBAUTHN_RP_ID = 'voult.dev';
    process.env.WEBAUTHN_ORIGIN = 'https://www.voult.dev';
    process.env.WEBAUTHN_RP_NAME = 'Voult';

    const config = WebAuthnService.getConfig('Ignored');

    expect(config.rpID).toBe('voult.dev');
    expect(config.origin).toBe('https://www.voult.dev');
    expect(config.rpName).toBe('Voult');
  });
});

describe('WebAuthnService browser compatibility', () => {
  test('documents supported browsers and algorithms', () => {
    const compatibility = WebAuthnService.getBrowserCompatibility();

    expect(compatibility.chrome.passkeys).toBe(true);
    expect(compatibility.firefox.passkeys).toBe(true);
    expect(compatibility.safari.passkeys).toBe(true);
    expect(compatibility.edge.passkeys).toBe(true);
    expect(compatibility.algorithms.map((a) => a.id)).toEqual([-8, -7, -257]);
    expect(compatibility.notes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/HTTPS/i),
        expect.stringMatching(/rpID/i)
      ])
    );
  });
});
