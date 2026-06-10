const { isStrongSecret } = require('../../src/secrets/secretGenerator');

describe('Config Secrets Validation', () => {
    test('isStrongSecret returns false for short strings', () => {
        expect(isStrongSecret('short')).toBe(false);
    });

    test('isStrongSecret returns true for strong 32+ char strings', () => {
        expect(isStrongSecret('a'.repeat(32))).toBe(true);
    });

    test('isStrongSecret returns false for repetitive short strings', () => {
        expect(isStrongSecret('a'.repeat(20))).toBe(false);
    });
});