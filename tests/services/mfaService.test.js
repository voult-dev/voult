const speakeasy = require('speakeasy');
const MFAService = require('../../services/mfaService');

describe('MFAService secret and QR generation', () => {
  test('generateSecret returns base32 secret with issuer label', () => {
    const secret = MFAService.generateSecret('user@example.com', 'MyApp');

    expect(secret.base32).toBeTruthy();
    expect(secret.otpauth_url).toContain('MyApp');
    expect(secret.otpauth_url).toContain('user%40example.com');
  });

  test('generateQRCode returns a data URL', async () => {
    const secret = MFAService.generateSecret('user@example.com');
    const qrCode = await MFAService.generateQRCode(secret);

    expect(qrCode).toMatch(/^data:image\/png;base64,/);
  });
});

describe('MFAService TOTP verification', () => {
  test('verifyToken accepts valid 6-digit code with whitespace stripped', () => {
    const secret = MFAService.generateSecret('user@example.com');
    const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' });

    expect(MFAService.verifyToken(secret.base32, ` ${token} `)).toBe(true);
  });

  test('verifyToken rejects missing secret or token', () => {
    expect(MFAService.verifyToken(null, '123456')).toBe(false);
    expect(MFAService.verifyToken('SECRET', null)).toBe(false);
    expect(MFAService.verifyToken('SECRET', '000000')).toBe(false);
  });
});

describe('MFAService setup expiry', () => {
  test('getSetupExpiry returns a future timestamp', () => {
    const expires = MFAService.getSetupExpiry();
    expect(expires.getTime()).toBeGreaterThan(Date.now());
    expect(expires.getTime()).toBeLessThanOrEqual(Date.now() + 11 * 60 * 1000);
  });

  test('isSetupExpired detects expired and active sessions', () => {
    expect(MFAService.isSetupExpired(null)).toBe(true);
    expect(MFAService.isSetupExpired(new Date(Date.now() - 1000))).toBe(true);
    expect(MFAService.isSetupExpired(new Date(Date.now() + 60_000))).toBe(false);
  });
});

describe('MFAService lockout handling', () => {
  test('recordFailedMfaAttempt increments counter and locks after threshold', async () => {
    const user = {
      failedMfaAttempts: 4,
      mfaLockUntil: null,
      save: jest.fn().mockResolvedValue(undefined)
    };

    await MFAService.recordFailedMfaAttempt(user);

    expect(user.failedMfaAttempts).toBe(5);
    expect(user.mfaLockUntil).toBeInstanceOf(Date);
    expect(user.mfaLockUntil.getTime()).toBeGreaterThan(Date.now());
    expect(user.save).toHaveBeenCalled();
  });

  test('resetFailedMfaAttempts clears counters', async () => {
    const user = {
      failedMfaAttempts: 3,
      mfaLockUntil: new Date(Date.now() + 60_000),
      save: jest.fn().mockResolvedValue(undefined)
    };

    await MFAService.resetFailedMfaAttempts(user);

    expect(user.failedMfaAttempts).toBe(0);
    expect(user.mfaLockUntil).toBeNull();
    expect(user.save).toHaveBeenCalled();
  });

  test('isMfaLocked returns true only while lock is active', () => {
    expect(MFAService.isMfaLocked({ mfaLockUntil: null })).toBe(false);
    expect(MFAService.isMfaLocked({ mfaLockUntil: new Date(Date.now() - 1000) })).toBe(false);
    expect(MFAService.isMfaLocked({ mfaLockUntil: new Date(Date.now() + 60_000) })).toBe(true);
  });
});

describe('MFAService backup codes', () => {
  test('generateBackupCodes returns requested number of codes', () => {
    const codes = MFAService.generateBackupCodes(5);
    expect(codes).toHaveLength(5);
    codes.forEach((code) => expect(code).toMatch(/^[A-F0-9]{8}$/));
  });

  test('hashBackupCode is deterministic after normalization', () => {
    const first = MFAService.hashBackupCode('abcd1234');
    const second = MFAService.hashBackupCode(' abcd1234 ');
    expect(first).toBe(second);
  });

  test('consumeBackupCode removes a used code', () => {
    const codes = MFAService.generateBackupCodes(2);
    const hashedCodes = MFAService.hashBackupCodes(codes);
    const result = MFAService.consumeBackupCode(codes[0], hashedCodes);

    expect(result.valid).toBe(true);
    expect(result.remainingCodes).toHaveLength(1);
    expect(MFAService.verifyBackupCode(codes[0], result.remainingCodes)).toBe(false);
  });
});
