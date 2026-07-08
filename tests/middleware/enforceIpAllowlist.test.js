jest.mock('../../services/ipAllowlistService', () => ({
  isRequestAllowed: jest.fn(),
  recordBlockedRequest: jest.fn().mockResolvedValue(undefined)
}));

const IpAllowlistService = require('../../services/ipAllowlistService');
const enforceIpAllowlist = require('../../middleware/enforceIpAllowlist');
const { ApiError } = require('../../utils/apiError');

describe('enforceIpAllowlist middleware', () => {
  const next = jest.fn();
  const res = {};

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips when allowlist disabled', async () => {
    const req = { appClient: { ipAllowlistEnabled: false } };

    await enforceIpAllowlist(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(IpAllowlistService.isRequestAllowed).not.toHaveBeenCalled();
  });

  test('continues when IP is allowed', async () => {
    IpAllowlistService.isRequestAllowed.mockResolvedValue({
      allowed: true,
      reason: 'IP_ALLOWLISTED'
    });

    const req = { appClient: { ipAllowlistEnabled: true, _id: 'app1' } };

    await enforceIpAllowlist(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('blocks and records when IP is not allowed', async () => {
    IpAllowlistService.isRequestAllowed.mockResolvedValue({
      allowed: false,
      ip: '198.51.100.1'
    });

    const req = {
      appClient: { ipAllowlistEnabled: true, _id: 'app1' },
      originalUrl: '/api/auth/email-login',
      headers: {}
    };

    await enforceIpAllowlist(req, res, next);

    expect(IpAllowlistService.recordBlockedRequest).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ApiError));
    expect(next.mock.calls[0][0].code).toBe('IP_NOT_ALLOWLISTED');
  });
});
