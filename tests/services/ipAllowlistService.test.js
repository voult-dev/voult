jest.mock('../../models/app');
jest.mock('../../models/developer');
jest.mock('../../models/ipAllowlistEntry');
jest.mock('../../models/ipAllowlistAlert');
jest.mock('../../services/auditService', () => ({
  log: jest.fn().mockResolvedValue(undefined),
  getClientIp: jest.fn().mockReturnValue('203.0.113.50')
}));
jest.mock('../../services/emailService', () => ({
  sendIpAllowlistAlert: jest.fn().mockResolvedValue(undefined)
}));

const IpAllowlistService = require('../../services/ipAllowlistService');
const { ipMatchesAllowlist } = require('../../utils/ipMatcher');

describe('IpAllowlistService enforcement', () => {
  const app = {
    _id: '507f1f77bcf86cd799439012',
    owner: { equals: () => false },
    ipAllowlistEnabled: true,
    ipAllowlistNotifyNewIps: true,
    name: 'Test App'
  };

  beforeEach(() => {
    process.env.TRUSTED_IPS = '';
    process.env.PLATFORM_ADMIN_IPS = '';
    jest.clearAllMocks();
  });

  test('allows requests when allowlist is disabled', async () => {
    const result = await IpAllowlistService.isRequestAllowed(
      { headers: {}, ip: '203.0.113.50' },
      { ...app, ipAllowlistEnabled: false }
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('ALLOWLIST_DISABLED');
  });

  test('allows platform admin IPs', async () => {
    process.env.PLATFORM_ADMIN_IPS = '203.0.113.50';

    const result = await IpAllowlistService.isRequestAllowed(
      { headers: {}, ip: '203.0.113.50', isAuthenticated: () => false },
      app
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe('PLATFORM_ADMIN_IP');
  });

  test('allows app owner developer session bypass', async () => {
    const ownerId = { equals: (id) => String(id) === 'dev1' };
    const ownerApp = { ...app, owner: ownerId };

    const result = await IpAllowlistService.shouldBypass(
      { isAuthenticated: () => true, user: { _id: 'dev1' }, headers: {} },
      ownerApp
    );

    expect(result.bypass).toBe(true);
    expect(result.reason).toBe('APP_OWNER_SESSION');
  });

  test('ipMatchesAllowlist gates unknown IPs', () => {
    const entries = [{ value: '203.0.113.0/24' }];

    expect(ipMatchesAllowlist('203.0.113.10', entries)).toBe(true);
    expect(ipMatchesAllowlist('198.51.100.1', entries)).toBe(false);
  });
});
