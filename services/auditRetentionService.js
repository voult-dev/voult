const AuditLog = require('../models/auditLog');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);
const RETENTION_INTERVAL_MS = parseInt(
  process.env.AUDIT_LOG_RETENTION_INTERVAL_MS || String(24 * 60 * 60 * 1000),
  10
);

function getRetentionDays() {
  const days = Number.isFinite(DEFAULT_RETENTION_DAYS) && DEFAULT_RETENTION_DAYS > 0
    ? DEFAULT_RETENTION_DAYS
    : 90;
  return days;
}

function getCutoffDate(retentionDays = getRetentionDays()) {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
}

class AuditRetentionService {
  static getRetentionDays() {
    return getRetentionDays();
  }

  static getCutoffDate() {
    return getCutoffDate();
  }

  static async purgeExpiredLogs(retentionDays = getRetentionDays()) {
    const cutoff = getCutoffDate(retentionDays);
    const result = await AuditLog.deleteMany({ timestamp: { $lt: cutoff } });
    return {
      deletedCount: result.deletedCount,
      cutoff,
      retentionDays
    };
  }

  static scheduleRetentionJob() {
    if (process.env.AUDIT_LOG_RETENTION_ENABLED === 'false') {
      return null;
    }

    const run = async () => {
      try {
        const result = await AuditRetentionService.purgeExpiredLogs();
        if (result.deletedCount > 0) {
          console.log(
            `[AUDIT RETENTION] Purged ${result.deletedCount} logs older than ${result.retentionDays} days`
          );
        }
      } catch (err) {
        console.error('[AUDIT RETENTION] Purge failed:', err.message);
      }
    };

    run();
    return setInterval(run, RETENTION_INTERVAL_MS);
  }
}

module.exports = AuditRetentionService;
