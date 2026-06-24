const AuditLog = require('../models/auditLog');
const GeolocationService = require('./geolocationService');
const RiskAssessmentService = require('./riskAssessmentService');

class AuditService {
  static getClientIp(req) {
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.connection?.remoteAddress
      || req.ip
      || '';

    return GeolocationService.normalizeIp(rawIp);
  }

  static buildQueryFilters(appId, options = {}) {
    const query = { appId };

    if (options.userId) {
      query.userId = options.userId;
    }

    if (options.action) {
      query.action = options.action;
    }

    if (options.status) {
      query.status = options.status;
    }

    if (options.riskLevel) {
      query.riskLevel = options.riskLevel;
    }

    if (options.ipAddress) {
      query.ipAddress = GeolocationService.normalizeIp(options.ipAddress);
    }

    if (options.startDate || options.endDate) {
      query.timestamp = {};
      if (options.startDate) {
        query.timestamp.$gte = new Date(options.startDate);
      }
      if (options.endDate) {
        query.timestamp.$lte = new Date(options.endDate);
      }
    }

    return query;
  }

  static getPagination(options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
    const skip = Math.max(parseInt(options.skip, 10) || 0, 0);
    return { limit, skip };
  }

  static async log(action, userId, appId, req, options = {}) {
    try {
      const ipAddress = this.getClientIp(req);
      const geolocation = options.geolocation ?? await GeolocationService.lookup(ipAddress);
      const status = options.status || 'SUCCESS';

      const assessment = await RiskAssessmentService.assess({
        action,
        status,
        userId,
        appId,
        ipAddress,
        geolocation,
        details: options.details || {}
      });

      let riskLevel = assessment.riskLevel;
      if (options.riskLevel) {
        riskLevel = RiskAssessmentService.maxRiskLevel(riskLevel, options.riskLevel);
      }

      const details = {
        ...(options.details || {})
      };

      if (assessment.factors.length > 0) {
        details.riskFactors = assessment.factors;
      }

      const log = new AuditLog({
        action,
        userId: userId || null,
        appId,
        ipAddress,
        userAgent: req.headers['user-agent'],
        details,
        status,
        riskLevel,
        geolocation: geolocation || undefined
      });

      await log.save();

      if (log.riskLevel === 'HIGH' || log.riskLevel === 'CRITICAL') {
        await this.sendSecurityAlert(log);
      }

      return log;
    } catch (err) {
      console.error('Audit logging failed:', err);
    }
  }

  static async sendSecurityAlert(log) {
    console.warn(`Security Alert: ${log.action} [${log.riskLevel}] user=${log.userId} app=${log.appId}`);
  }

  static async queryLogs(appId, options = {}) {
    const query = this.buildQueryFilters(appId, options);
    const { limit, skip } = this.getPagination(options);

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return { logs, total, limit, skip };
  }

  static async getAuditTrail(userId, appId, options = {}) {
    return this.queryLogs(appId, { ...options, userId });
  }

  static async queryByIp(appId, ipAddress, options = {}) {
    return this.queryLogs(appId, { ...options, ipAddress });
  }

  static async queryByAction(appId, action, options = {}) {
    return this.queryLogs(appId, { ...options, action });
  }

  static async queryHighRiskEvents(appId, options = {}) {
    const minRisk = options.minRiskLevel || 'HIGH';
    const allowedLevels = minRisk === 'CRITICAL'
      ? ['CRITICAL']
      : ['HIGH', 'CRITICAL'];

    const query = this.buildQueryFilters(appId, options);
    query.riskLevel = { $in: allowedLevels };

    const { limit, skip } = this.getPagination(options);
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(skip)
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return { logs, total, limit, skip };
  }

  static async getSecuritySummary(appId, options = {}) {
    const startDate = options.startDate
      ? new Date(options.startDate)
      : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = options.endDate ? new Date(options.endDate) : new Date();
    const match = {
      appId,
      timestamp: { $gte: startDate, $lte: endDate }
    };

    const [byAction, byRisk, byStatus, recentHighRisk] = await Promise.all([
      AuditLog.aggregate([
        { $match: match },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.aggregate([
        { $match: match },
        { $group: { _id: '$riskLevel', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      AuditLog.find({
        ...match,
        riskLevel: { $in: ['HIGH', 'CRITICAL'] }
      })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean()
    ]);

    return {
      window: { startDate, endDate },
      totals: {
        events: byAction.reduce((sum, item) => sum + item.count, 0),
        byAction: byAction.map((item) => ({ action: item._id, count: item.count })),
        byRisk: byRisk.map((item) => ({ riskLevel: item._id, count: item.count })),
        byStatus: byStatus.map((item) => ({ status: item._id, count: item.count }))
      },
      recentHighRisk
    };
  }
}

module.exports = AuditService;
