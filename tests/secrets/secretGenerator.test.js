const { generateSecret, isStrongSecret } = require('../../src/secrets/secretGenerator');

describe('Secret Generator', () => {
    test('should generate 32-character secret by default', () => {
        const secret = generateSecret();
        expect(secret.length).toBe(32);
    });

    test('should generate secret with custom length', () => {
        const secret = generateSecret(64);
        expect(secret.length).toBe(64);
    });

    test('should generate hex string', () => {
        const secret = generateSecret();
        expect(/^[a-f0-9]+$/.test(secret)).toBe(true);
    });

    test('should generate unique secrets', () => {
        const secret1 = generateSecret();
        const secret2 = generateSecret();
        expect(secret1).not.toBe(secret2);
    });

    test('isStrongSecret returns false for short strings', () => {
        expect(isStrongSecret('a'.repeat(31))).toBe(false);
    });

    test('isStrongSecret returns true for 32+ char strings', () => {
        expect(isStrongSecret('a'.repeat(32))).toBe(true);
        expect(isStrongSecret(generateSecret())).toBe(true);
    });

    test('calculateEntropy should return positive number', () => {
        const secret = generateSecret(32);
        const { calculateEntropy } = require('../../src/secrets/secretGenerator');
        const entropy = calculateEntropy(secret);
        expect(entropy).toBeGreaterThan(0);
    });
});