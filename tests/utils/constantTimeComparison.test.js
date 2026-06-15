const { constantTimeCompare } = require('../../utils/constantTimeComparison');

describe('constantTimeCompare', () => {
    test('returns true for matching strings', () => {
        expect(constantTimeCompare('abcdef', 'abcdef')).toBe(true);
    });

    test('returns false for different strings', () => {
        expect(constantTimeCompare('abcdef', 'abcdeg')).toBe(false);
    });

    test('returns false for different lengths', () => {
        expect(constantTimeCompare('abcdef', 'abcde')).toBe(false);
    });
});
