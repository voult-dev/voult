const IpAllowlistService = require('../services/ipAllowlistService');
const { ApiError } = require('../utils/apiError');

module.exports = async function enforceIpAllowlist(req, res, next) {
  if (!req.appClient || !req.appClient.ipAllowlistEnabled) {
    return next();
  }

  try {
    const result = await IpAllowlistService.isRequestAllowed(req, req.appClient);

    if (result.allowed) {
      return next();
    }

    await IpAllowlistService.recordBlockedRequest(req, req.appClient);

    throw new ApiError(
      403,
      'IP_NOT_ALLOWLISTED',
      'Request blocked: IP address is not on the application allowlist'
    );
  } catch (err) {
    return next(err);
  }
};
