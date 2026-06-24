const AuditLog = require('../models/auditLog');

const RISK_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const HIGH_RISK_ACTIONS = new Set([
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'ACCOUNT_DISABLED',
  'OAUTH_UNLINK',
  'TOKEN_REVOKED',
  'SESSION_REVOKED'
]);

const AUTH_FAILURE_ACTIONS = new Set([
  'LOGIN_FAILURE',
  'LOGIN_ATTEMPT_THROTTLED'
]);

function maxRiskLevel(current, candidate) {
  const currentIndex = RISK_ORDER.indexOf(current);
  const candidateIndex = RISK_ORDER.indexOf(candidate);
  return candidateIndex > currentIndex ? candidate : current;
}

function baselineRisk(action, status) {
  if (HIGH_RISK_ACTIONS.has(action)) {
    return status === 'FAILURE' ? 'HIGH' : 'MEDIUM';
  }

  if (AUTH_FAILURE_ACTIONS.has(action) || (action === 'REGISTER' && status === 'FAILURE')) {
    return 'MEDIUM';
  }

  if (action === 'LOGIN_SUCCESS' || action === 'OAUTH_LOGIN') {
    return 'LOW';
  }

  return 'LOW';
}

class RiskAssessmentService {
  static maxRiskLevel(current, candidate) {
    return maxRiskLevel(current, candidate);
  }

  static async assess({
    action,
    status = 'SUCCESS',
    userId,
    appId,
    ipAddress,
    geolocation,
    details = {}
  }) {
    let riskLevel = baselineRisk(action, status);
    const factors = [];

    if (details.reason === 'ACCOUNT_LOCKED') {
      riskLevel = maxRiskLevel(riskLevel, 'HIGH');
      factors.push('ACCOUNT_LOCKED');
    }

    if (action === 'LOGIN_FAILURE' && details.reason === 'INVALID_PASSWORD') {
      riskLevel = maxRiskLevel(riskLevel, 'MEDIUM');
    }

    if (ipAddress && appId) {
      const since = new Date(Date.now() - 15 * 60 * 1000);
      const ipFailureCount = await AuditLog.countDocuments({
        appId,
        ipAddress,
        action: { $in: ['LOGIN_FAILURE', 'LOGIN_ATTEMPT_THROTTLED'] },
        timestamp: { $gte: since }
      });

      if (ipFailureCount >= 5) {
        riskLevel = maxRiskLevel(riskLevel, 'HIGH');
        factors.push('REPEATED_IP_FAILURES');
      } else if (ipFailureCount >= 3) {
        riskLevel = maxRiskLevel(riskLevel, 'MEDIUM');
        factors.push('ELEVATED_IP_FAILURES');
      }
    }

    if (userId && appId) {
      const since = new Date(Date.now() - 15 * 60 * 1000);
      const userFailureCount = await AuditLog.countDocuments({
        appId,
        userId,
        action: 'LOGIN_FAILURE',
        timestamp: { $gte: since }
      });

      if (userFailureCount >= 3) {
        riskLevel = maxRiskLevel(riskLevel, 'MEDIUM');
        factors.push('REPEATED_USER_FAILURES');
      }
    }

    if (
      userId
      && appId
      && geolocation?.country
      && action === 'LOGIN_SUCCESS'
    ) {
      const lastSuccess = await AuditLog.findOne({
        appId,
        userId,
        action: 'LOGIN_SUCCESS',
        'geolocation.country': { $exists: true, $ne: null }
      })
        .sort({ timestamp: -1 })
        .select('geolocation timestamp');

      if (
        lastSuccess?.geolocation?.country
        && lastSuccess.geolocation.country !== geolocation.country
      ) {
        const hoursSinceLastLogin =
          (Date.now() - new Date(lastSuccess.timestamp).getTime()) / (60 * 60 * 1000);

        if (hoursSinceLastLogin <= 1) {
          riskLevel = maxRiskLevel(riskLevel, 'CRITICAL');
          factors.push('IMPOSSIBLE_TRAVEL');
        } else if (hoursSinceLastLogin <= 24) {
          riskLevel = maxRiskLevel(riskLevel, 'HIGH');
          factors.push('NEW_COUNTRY_LOGIN');
        }
      }
    }

    if (
      userId
      && ipAddress
      && appId
      && ['LOGIN_SUCCESS', 'PASSWORD_RESET', 'PASSWORD_CHANGE'].includes(action)
    ) {
      const knownIp = await AuditLog.exists({
        appId,
        userId,
        ipAddress,
        status: 'SUCCESS',
        timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });

      if (!knownIp) {
        riskLevel = maxRiskLevel(riskLevel, action === 'LOGIN_SUCCESS' ? 'MEDIUM' : 'HIGH');
        factors.push('NEW_IP_FOR_USER');
      }
    }

    return { riskLevel, factors };
  }
}

module.exports = RiskAssessmentService;
