const AuditService = require('../../services/auditService');
const AuditRetentionService = require('../../services/auditRetentionService');
const { ApiError } = require('../../utils/apiError');

function parseQueryOptions(query) {
  return {
    userId: query.userId,
    action: query.action,
    status: query.status,
    riskLevel: query.riskLevel,
    ipAddress: query.ipAddress,
    startDate: query.startDate,
    endDate: query.endDate,
    limit: query.limit,
    skip: query.skip,
    minRiskLevel: query.minRiskLevel
  };
}

module.exports.listAppLogs = async (req, res) => {
  const app = req.appClient;
  const result = await AuditService.queryLogs(app._id, parseQueryOptions(req.query));

  res.status(200).json(result);
};

module.exports.getAppSummary = async (req, res) => {
  const app = req.appClient;
  const summary = await AuditService.getSecuritySummary(app._id, {
    startDate: req.query.startDate,
    endDate: req.query.endDate
  });

  res.status(200).json(summary);
};

module.exports.listHighRiskEvents = async (req, res) => {
  const app = req.appClient;
  const result = await AuditService.queryHighRiskEvents(app._id, parseQueryOptions(req.query));

  res.status(200).json(result);
};

module.exports.listMyLogs = async (req, res) => {
  if (!req.endUser) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const result = await AuditService.getAuditTrail(
    req.endUser._id,
    req.appClient._id,
    parseQueryOptions(req.query)
  );

  res.status(200).json(result);
};

module.exports.getRetentionPolicy = async (req, res) => {
  res.status(200).json({
    retentionDays: AuditRetentionService.getRetentionDays(),
    cutoffDate: AuditRetentionService.getCutoffDate(),
    geolocationEnabled: process.env.AUDIT_GEOLOCATION_ENABLED === 'true',
    retentionEnabled: process.env.AUDIT_LOG_RETENTION_ENABLED !== 'false'
  });
};
