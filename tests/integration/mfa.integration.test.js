const speakeasy = require('speakeasy');
const { ApiError } = require('../../utils/apiError');
const MFAService = require('../../services/mfaService');
const AuditService = require('../../services/auditService');
const { completeEndUserLogin } = require('../../services/authLoginService');
const { signMfaPendingToken } = require('../../utils/jwt');
const {
  mockUsers,
  mockFindUser,
  mockCreateUser,
  resetMockUsers
} = require('../helpers/mockEndUserStore');

jest.mock('../../services/auditService', () => ({
  log: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../services/authLoginService', () => ({
  completeEndUserLogin: jest.fn().mockImplementation((req, res) =>
    res.status(200).json({ message: 'Login successful', accessToken: 'access', refreshToken: 'refresh' })
  )
}));

jest.mock('../../middleware/queryValidation', () => ({
  SafeQueryBuilder: jest.fn().mockImplementation(() => ({
    findOne: (query) => ({
      select: () => Promise.resolve(mockFindUser(query))
    }),
    findById: (id) => ({
      select: () => Promise.resolve(mockUsers.get(String(id)) || null)
    })
  }))
}));

const mfaController = require('../../controllers/api/mfa');

function mockReq(overrides = {}) {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
    body: {},
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

async function expectApiError(fn, code) {
  await expect(fn()).rejects.toMatchObject({ status: code });
}

describe('MFA controller integration flow', () => {
  const app = { _id: '507f1f77bcf86cd799439012', name: 'Integration App' };

  beforeEach(() => {
    resetMockUsers();
    jest.clearAllMocks();
  });

  test('setup → enable → status completes enrollment', async () => {
    const user = mockCreateUser();
    const req = mockReq({ endUser: user, appClient: app });
    const setupRes = mockRes();

    await mfaController.setupMfa(req, setupRes);

    expect(setupRes.statusCode).toBe(200);
    expect(setupRes.body.backupCodes).toHaveLength(10);
    expect(setupRes.body.qrCode).toMatch(/^data:image\/png;base64,/);
    expect(user.mfaPendingSecret).toBeTruthy();
    expect(AuditService.log).toHaveBeenCalledWith(
      'BACKUP_CODES_GENERATED',
      user._id,
      app._id,
      req,
      expect.objectContaining({ details: expect.objectContaining({ stage: 'MFA_SETUP' }) })
    );

    const totp = speakeasy.totp({
      secret: user.mfaPendingSecret,
      encoding: 'base32'
    });

    const enableReq = mockReq({
      endUser: user,
      appClient: app,
      body: { token: totp }
    });
    const enableRes = mockRes();

    await mfaController.enableMfa(enableReq, enableRes);

    expect(enableRes.statusCode).toBe(200);
    expect(enableRes.body.mfaEnabled).toBe(true);
    expect(user.mfaEnabled).toBe(true);
    expect(user.mfaSecret).toBeTruthy();
    expect(user.mfaBackupCodes).toHaveLength(10);
    expect(user.tokenVersion).toBe(1);

    const statusReq = mockReq({ endUser: user, appClient: app });
    const statusRes = mockRes();

    await mfaController.getMfaStatus(statusReq, statusRes);

    expect(statusRes.body.mfaEnabled).toBe(true);
    expect(statusRes.body.backupCodesRemaining).toBe(10);
  });

  test('verifyMfaLogin accepts TOTP after password login step', async () => {
    const secret = MFAService.generateSecret('mfa-user@example.com');
    const user = mockCreateUser({
      mfaEnabled: true,
      mfaSecret: secret.base32,
      mfaBackupCodes: MFAService.hashBackupCodes(MFAService.generateBackupCodes(2)),
      tokenVersion: 1
    });

    const mfaPendingToken = signMfaPendingToken(user, app);
    const totp = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

    const req = mockReq({
      appClient: app,
      body: { mfaPendingToken, mfaToken: totp }
    });
    const res = mockRes();

    await mfaController.verifyMfaLogin(req, res);

    expect(completeEndUserLogin).toHaveBeenCalledWith(
      req,
      res,
      user,
      app,
      expect.objectContaining({ mfaMethod: 'totp' })
    );
  });

  test('verifyMfaLogin accepts backup code and audits consumption', async () => {
    const secret = MFAService.generateSecret('mfa-user@example.com');
    const plaintextCodes = MFAService.generateBackupCodes(2);
    const user = mockCreateUser({
      mfaEnabled: true,
      mfaSecret: secret.base32,
      mfaBackupCodes: MFAService.hashBackupCodes(plaintextCodes),
      tokenVersion: 1
    });

    const mfaPendingToken = signMfaPendingToken(user, app);
    const req = mockReq({
      appClient: app,
      body: { mfaPendingToken, mfaToken: plaintextCodes[0] }
    });
    const res = mockRes();

    await mfaController.verifyMfaLogin(req, res);

    expect(user.mfaBackupCodes).toHaveLength(1);
    expect(AuditService.log).toHaveBeenCalledWith(
      'BACKUP_CODE_USED',
      user._id,
      app._id,
      req,
      expect.objectContaining({
        details: expect.objectContaining({ backupCodesRemaining: 1 })
      })
    );
    expect(completeEndUserLogin).toHaveBeenCalledWith(
      req,
      res,
      user,
      app,
      expect.objectContaining({ mfaMethod: 'backup_code' })
    );
  });

  test('verifyMfaLogin locks out after repeated failures', async () => {
    const secret = MFAService.generateSecret('mfa-user@example.com');
    const user = mockCreateUser({
      mfaEnabled: true,
      mfaSecret: secret.base32,
      mfaBackupCodes: [],
      failedMfaAttempts: 4,
      tokenVersion: 1
    });

    const mfaPendingToken = signMfaPendingToken(user, app);
    const req = mockReq({
      appClient: app,
      body: { mfaPendingToken, mfaToken: '000000' }
    });

    await expectApiError(
      () => mfaController.verifyMfaLogin(req, mockRes()),
      401
    );

    expect(user.failedMfaAttempts).toBe(5);
    expect(user.mfaLockUntil).toBeInstanceOf(Date);

    const lockedReq = mockReq({
      appClient: app,
      body: { mfaPendingToken, mfaToken: speakeasy.totp({ secret: secret.base32, encoding: 'base32' }) }
    });

    await expectApiError(
      () => mfaController.verifyMfaLogin(lockedReq, mockRes()),
      423
    );
  });

  test('regenerateBackupCodes replaces stored hashes after TOTP confirmation', async () => {
    const secret = MFAService.generateSecret('mfa-user@example.com');
    const oldCodes = MFAService.hashBackupCodes(MFAService.generateBackupCodes(2));
    const user = mockCreateUser({
      mfaEnabled: true,
      mfaSecret: secret.base32,
      mfaBackupCodes: oldCodes,
      tokenVersion: 2
    });

    const totp = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
    const req = mockReq({
      endUser: user,
      appClient: app,
      body: { mfaToken: totp }
    });
    const res = mockRes();

    await mfaController.regenerateBackupCodes(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.backupCodes).toHaveLength(10);
    expect(user.mfaBackupCodes).toHaveLength(10);
    expect(user.mfaBackupCodes).not.toEqual(oldCodes);
    expect(user.tokenVersion).toBe(3);
    expect(AuditService.log).toHaveBeenCalledWith(
      'BACKUP_CODES_REGENERATED',
      user._id,
      app._id,
      req,
      expect.objectContaining({ riskLevel: 'HIGH' })
    );
  });

  test('disableMfa clears secrets and bumps tokenVersion', async () => {
    const secret = MFAService.generateSecret('mfa-user@example.com');
    const user = mockCreateUser({
      mfaEnabled: true,
      mfaSecret: secret.base32,
      mfaBackupCodes: MFAService.hashBackupCodes(MFAService.generateBackupCodes(2)),
      tokenVersion: 2
    });

    const totp = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });
    const req = mockReq({
      endUser: user,
      appClient: app,
      body: { password: 'Password123!', mfaToken: totp }
    });
    const res = mockRes();

    await mfaController.disableMfa(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.mfaEnabled).toBe(false);
    expect(user.mfaEnabled).toBe(false);
    expect(user.mfaSecret).toBeUndefined();
    expect(user.mfaBackupCodes).toEqual([]);
    expect(user.tokenVersion).toBe(3);
    expect(AuditService.log).toHaveBeenCalledWith('MFA_DISABLED', user._id, app._id, req);
  });

  test('enableMfa rejects expired setup sessions', async () => {
    const user = mockCreateUser({
      mfaPendingSecret: 'JBSWY3DPEHPK3PXP',
      mfaPendingExpires: new Date(Date.now() - 1000)
    });

    const req = mockReq({
      endUser: user,
      appClient: app,
      body: { token: '123456' }
    });

    await expect(
      mfaController.enableMfa(req, mockRes())
    ).rejects.toBeInstanceOf(ApiError);
  });
});
