const MFAService = require('../../services/mfaService');

describe('MFAService', () => {
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

  test('verifyToken validates generated secret', () => {
    const secret = MFAService.generateSecret('user@example.com');
    const token = require('speakeasy').totp({
      secret: secret.base32,
      encoding: 'base32'
    });

    expect(MFAService.verifyToken(secret.base32, token)).toBe(true);
    expect(MFAService.verifyToken(secret.base32, '000000')).toBe(false);
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
