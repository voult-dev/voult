const MFAService = require('../../services/mfaService');

describe('Backup code generation', () => {
  test('createBackupCodeSet returns matching plaintext and hashed sets', () => {
    const { plaintextCodes, hashedCodes } = MFAService.createBackupCodeSet(10);

    expect(plaintextCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);
    plaintextCodes.forEach((code, index) => {
      expect(MFAService.hashBackupCode(code)).toBe(hashedCodes[index]);
    });
  });

  test('generated codes are unique within a set', () => {
    const { plaintextCodes } = MFAService.createBackupCodeSet(10);
    expect(new Set(plaintextCodes).size).toBe(10);
  });
});

describe('Backup code validation', () => {
  test('verifyBackupCode accepts valid codes with normalization', () => {
    const { plaintextCodes, hashedCodes } = MFAService.createBackupCodeSet(3);

    expect(MFAService.verifyBackupCode(plaintextCodes[0], hashedCodes)).toBe(true);
    expect(MFAService.verifyBackupCode(` ${plaintextCodes[1].toLowerCase()} `, hashedCodes)).toBe(true);
    expect(MFAService.verifyBackupCode('NOTVALID1', hashedCodes)).toBe(false);
  });
});

describe('Backup code one-time use', () => {
  test('consumed code cannot be reused', () => {
    const { plaintextCodes, hashedCodes } = MFAService.createBackupCodeSet(2);
    const firstUse = MFAService.consumeBackupCode(plaintextCodes[0], hashedCodes);

    expect(firstUse.valid).toBe(true);
    expect(firstUse.remainingCodes).toHaveLength(1);

    const secondUse = MFAService.consumeBackupCode(plaintextCodes[0], firstUse.remainingCodes);
    expect(secondUse.valid).toBe(false);
    expect(secondUse.remainingCodes).toHaveLength(1);
  });

  test('each code in a set can be consumed once', () => {
    const { plaintextCodes, hashedCodes } = MFAService.createBackupCodeSet(3);
    let remaining = hashedCodes;

    plaintextCodes.forEach((code) => {
      const result = MFAService.consumeBackupCode(code, remaining);
      expect(result.valid).toBe(true);
      remaining = result.remainingCodes;
    });

    expect(remaining).toHaveLength(0);
  });

  test('invalid consume leaves storage unchanged', () => {
    const { plaintextCodes, hashedCodes } = MFAService.createBackupCodeSet(2);
    const result = MFAService.consumeBackupCode('BADCODE1', hashedCodes);

    expect(result.valid).toBe(false);
    expect(result.remainingCodes).toEqual(hashedCodes);
    expect(MFAService.verifyBackupCode(plaintextCodes[0], result.remainingCodes)).toBe(true);
  });
});

describe('Backup code storage format', () => {
  test('stored hashes are SHA-256 hex strings, not plaintext codes', () => {
    const { plaintextCodes, hashedCodes } = MFAService.createBackupCodeSet(2);

    hashedCodes.forEach((hash, index) => {
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).not.toBe(plaintextCodes[index]);
    });
  });
});
