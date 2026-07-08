const { isValidCidr, ipMatchesCidr, ipMatchesAllowlist } = require('../../utils/ipMatcher');

describe('ipMatcher', () => {
  test('isValidCidr accepts IPv4 and CIDR', () => {
    expect(isValidCidr('203.0.113.10')).toBe(true);
    expect(isValidCidr('203.0.113.0/24')).toBe(true);
    expect(isValidCidr('999.0.0.1')).toBe(false);
    expect(isValidCidr('203.0.113.0/99')).toBe(false);
  });

  test('ipMatchesCidr matches exact IP', () => {
    expect(ipMatchesCidr('203.0.113.10', '203.0.113.10')).toBe(true);
    expect(ipMatchesCidr('203.0.113.11', '203.0.113.10')).toBe(false);
  });

  test('ipMatchesCidr matches CIDR ranges', () => {
    expect(ipMatchesCidr('203.0.113.10', '203.0.113.0/24')).toBe(true);
    expect(ipMatchesCidr('203.0.114.1', '203.0.113.0/24')).toBe(false);
    expect(ipMatchesCidr('10.0.0.50', '10.0.0.0/8')).toBe(true);
  });

  test('ipMatchesAllowlist checks multiple entries', () => {
    const entries = [
      { value: '203.0.113.0/24' },
      { value: '198.51.100.5' }
    ];

    expect(ipMatchesAllowlist('203.0.113.99', entries)).toBe(true);
    expect(ipMatchesAllowlist('198.51.100.5', entries)).toBe(true);
    expect(ipMatchesAllowlist('192.168.1.1', entries)).toBe(false);
  });
});
