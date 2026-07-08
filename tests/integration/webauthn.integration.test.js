jest.mock('../../services/auditService', () => ({
  log: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../services/authLoginService', () => ({
  completeEndUserLogin: jest.fn().mockImplementation((req, res) =>
    res.status(200).json({ message: 'Login successful', accessToken: 'at', refreshToken: 'rt' })
  )
}));

const WebAuthnService = require('../../services/webAuthnService');
const AuditService = require('../../services/auditService');
const { completeEndUserLogin } = require('../../services/authLoginService');
const controller = require('../../controllers/api/webauthn');

function mockReq(overrides = {}) {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
    body: {},
    params: {},
    ...overrides
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    }
  };
  return res;
}

describe('WebAuthn controller integration', () => {
  const app = { _id: '507f1f77bcf86cd799439012', name: 'Test App', clientId: 'app_test' };
  const user = {
    _id: '507f1f77bcf86cd799439011',
    email: 'passkey@example.com',
    username: 'passkeyuser',
    isEmailVerified: true,
    isActive: true,
    mfaEnabled: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registrationOptions returns WebAuthn options', async () => {
    const options = { challenge: 'test-challenge', rp: { id: 'localhost' } };
    jest.spyOn(WebAuthnService, 'createRegistrationOptions').mockResolvedValue({
      options,
      deviceName: 'MacBook'
    });

    const req = mockReq({ endUser: user, appClient: app, body: { deviceName: 'MacBook' } });
    const res = mockRes();

    await controller.registrationOptions(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.options).toEqual(options);
    expect(res.body.deviceName).toBe('MacBook');
  });

  test('registrationVerify stores credential and audits', async () => {
    const record = {
      _id: 'cred1',
      deviceName: 'MacBook',
      credentialDeviceType: 'multiDevice',
      credentialBackedUp: true,
      createdAt: new Date()
    };

    jest.spyOn(WebAuthnService, 'verifyRegistration').mockResolvedValue(record);

    const req = mockReq({
      endUser: user,
      appClient: app,
      body: { credential: { id: 'cred' }, deviceName: 'MacBook' }
    });
    const res = mockRes();

    await controller.registrationVerify(req, res);

    expect(res.statusCode).toBe(201);
    expect(AuditService.log).toHaveBeenCalledWith(
      'WEBAUTHN_REGISTERED',
      user._id,
      app._id,
      req,
      expect.any(Object)
    );
  });

  test('authenticationVerify completes login via passkey', async () => {
    jest.spyOn(WebAuthnService, 'verifyAuthentication').mockResolvedValue(user);

    const req = mockReq({
      appClient: app,
      body: { credential: { id: 'webauthn-id' } }
    });
    const res = mockRes();

    await controller.authenticationVerify(req, res);

    expect(completeEndUserLogin).toHaveBeenCalledWith(
      req,
      res,
      user,
      app,
      expect.objectContaining({ method: 'webauthn' })
    );
  });

  test('listCredentials returns device list', async () => {
    jest.spyOn(WebAuthnService, 'listCredentials').mockResolvedValue([
      {
        _id: 'cred1',
        deviceName: 'iPhone',
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true,
        transports: ['internal'],
        lastUsedAt: null,
        createdAt: new Date()
      }
    ]);

    const req = mockReq({ endUser: user, appClient: app });
    const res = mockRes();

    await controller.listCredentials(req, res);

    expect(res.body.credentials).toHaveLength(1);
    expect(res.body.credentials[0].deviceName).toBe('iPhone');
  });

  test('deleteCredential audits removal', async () => {
    jest.spyOn(WebAuthnService, 'deleteCredential').mockResolvedValue({
      _id: 'cred1',
      deviceName: 'iPhone'
    });

    const req = mockReq({
      endUser: user,
      appClient: app,
      params: { id: 'cred1' }
    });
    const res = mockRes();

    await controller.deleteCredential(req, res);

    expect(AuditService.log).toHaveBeenCalledWith(
      'WEBAUTHN_CREDENTIAL_REMOVED',
      user._id,
      app._id,
      req,
      expect.objectContaining({ riskLevel: 'MEDIUM' })
    );
  });

  test('getCompatibility exposes browser support matrix', async () => {
    const req = mockReq({ appClient: app });
    const res = mockRes();

    await controller.getCompatibility(req, res);

    expect(res.body.chrome.passkeys).toBe(true);
    expect(res.body.rpID).toBeDefined();
    expect(res.body.origin).toBeDefined();
  });
});
