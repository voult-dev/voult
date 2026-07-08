const App = require('../models/app');
const Developer = require('../models/developer');
const IpAllowlistEntry = require('../models/ipAllowlistEntry');
const IpAllowlistAlert = require('../models/ipAllowlistAlert');
const { SafeQueryBuilder } = require('../middleware/queryValidation');
const { ipMatchesAllowlist } = require('../utils/ipMatcher');
const { isValidCidr } = require('../utils/ipMatcher');
const AuditService = require('./auditService');
const GeolocationService = require('./geolocationService');
const { sendIpAllowlistAlert } = require('./emailService');
const { ApiError } = require('../utils/apiError');

const appBuilder = new SafeQueryBuilder(App);
const entryBuilder = new SafeQueryBuilder(IpAllowlistEntry);
const alertBuilder = new SafeQueryBuilder(IpAllowlistAlert);
const developerBuilder = new SafeQueryBuilder(Developer);

function getTrustedIps() {
  const trusted = (process.env.TRUSTED_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean);
  const platformAdmin = (process.env.PLATFORM_ADMIN_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean);
  return [...new Set([...trusted, ...platformAdmin])];
}

function isPlatformAdminIp(ip) {
  return getTrustedIps().includes(GeolocationService.normalizeIp(ip));
}

class IpAllowlistService {
  static normalizeIp(ip) {
    return GeolocationService.normalizeIp(ip);
  }

  static async getSettings(appId) {
    const app = await appBuilder.findById(appId).select('ipAllowlistEnabled ipAllowlistNotifyNewIps name clientId');
    if (!app) {
      throw new ApiError(404, 'APP_NOT_FOUND', 'Application not found');
    }

    const entryCount = await entryBuilder.countDocuments({ app: appId });

    return {
      enabled: Boolean(app.ipAllowlistEnabled),
      notifyNewIps: Boolean(app.ipAllowlistNotifyNewIps),
      entryCount,
      clientId: app.clientId,
      appName: app.name
    };
  }

  static async updateSettings(appId, { enabled, notifyNewIps }) {
    const app = await appBuilder.findById(appId);
    if (!app) {
      throw new ApiError(404, 'APP_NOT_FOUND', 'Application not found');
    }

    if (typeof enabled === 'boolean') {
      app.ipAllowlistEnabled = enabled;
    }
    if (typeof notifyNewIps === 'boolean') {
      app.ipAllowlistNotifyNewIps = notifyNewIps;
    }

    await app.save();
    return this.getSettings(appId);
  }

  static async listEntries(appId) {
    return entryBuilder.find({ app: appId }).sort({ createdAt: -1 });
  }

  static async addEntry(appId, developerId, { value, label, isAdminBypass }) {
    const normalizedValue = String(value).trim();

    if (!isValidCidr(normalizedValue)) {
      throw new ApiError(400, 'INVALID_IP_OR_CIDR', 'Value must be a valid IPv4 address or CIDR');
    }

    const existing = await entryBuilder.findOne({ app: appId, value: normalizedValue });
    if (existing) {
      throw new ApiError(409, 'IP_ALLOWLIST_EXISTS', 'This IP or CIDR is already allowlisted');
    }

    return IpAllowlistEntry.create({
      app: appId,
      value: normalizedValue,
      label: label || '',
      isAdminBypass: Boolean(isAdminBypass),
      createdBy: developerId
    });
  }

  static async removeEntry(appId, entryId) {
    const entry = await entryBuilder.findOne({ _id: entryId, app: appId });
    if (!entry) {
      throw new ApiError(404, 'IP_ALLOWLIST_NOT_FOUND', 'Allowlist entry not found');
    }

    await entry.deleteOne();
    return entry;
  }

  static async listAlerts(appId, { acknowledged } = {}) {
    const query = { app: appId };
    if (acknowledged === 'true') {
      query.acknowledged = true;
    } else if (acknowledged === 'false') {
      query.acknowledged = false;
    }

    return alertBuilder.find(query).sort({ lastSeenAt: -1 }).limit(100);
  }

  static async acknowledgeAlert(appId, alertId) {
    const alert = await alertBuilder.findOne({ _id: alertId, app: appId });
    if (!alert) {
      throw new ApiError(404, 'IP_ALERT_NOT_FOUND', 'Alert not found');
    }

    alert.acknowledged = true;
    await alert.save();
    return alert;
  }

  static async shouldBypass(req, app) {
    const ip = this.normalizeIp(AuditService.getClientIp(req));

    if (isPlatformAdminIp(ip)) {
      return { bypass: true, reason: 'PLATFORM_ADMIN_IP' };
    }

    if (req.isAuthenticated?.() && req.user?._id && app.owner?.equals(req.user._id)) {
      return { bypass: true, reason: 'APP_OWNER_SESSION' };
    }

    const bypassSecret = process.env.IP_ALLOWLIST_BYPASS_SECRET;
    if (bypassSecret && req.headers['x-ip-allowlist-bypass'] === bypassSecret) {
      return { bypass: true, reason: 'BYPASS_SECRET' };
    }

    const adminEntries = await entryBuilder.find({
      app: app._id,
      isAdminBypass: true
    });

    if (ipMatchesAllowlist(ip, adminEntries)) {
      return { bypass: true, reason: 'ADMIN_BYPASS_ENTRY' };
    }

    return { bypass: false, ip };
  }

  static async isRequestAllowed(req, app) {
    if (!app.ipAllowlistEnabled) {
      return { allowed: true, reason: 'ALLOWLIST_DISABLED' };
    }

    const bypass = await this.shouldBypass(req, app);
    if (bypass.bypass) {
      return { allowed: true, reason: bypass.reason };
    }

    const entries = await entryBuilder.find({ app: app._id, isAdminBypass: false });
    const ip = bypass.ip || this.normalizeIp(AuditService.getClientIp(req));

    if (ipMatchesAllowlist(ip, entries)) {
      return { allowed: true, reason: 'IP_ALLOWLISTED' };
    }

    return { allowed: false, ip };
  }

  static async recordBlockedRequest(req, app) {
    const ip = this.normalizeIp(AuditService.getClientIp(req));

    await AuditService.log('IP_ALLOWLIST_BLOCKED', null, app._id, req, {
      details: { path: req.originalUrl, ip },
      status: 'FAILURE',
      riskLevel: 'HIGH'
    });

    await this.upsertAlert(req, app, { blocked: true });
  }

  static async recordNewIpObservation(req, app) {
    const ip = this.normalizeIp(AuditService.getClientIp(req));

    await AuditService.log('IP_ALLOWLIST_NEW_IP', null, app._id, req, {
      details: { path: req.originalUrl, ip },
      riskLevel: 'MEDIUM'
    });

    await this.upsertAlert(req, app, { blocked: false });
  }

  static async upsertAlert(req, app, { blocked }) {
    if (!app.ipAllowlistNotifyNewIps) {
      return null;
    }

    const ip = this.normalizeIp(AuditService.getClientIp(req));
    const now = new Date();

    let alert = await alertBuilder.findOne({ app: app._id, ipAddress: ip });

    if (alert) {
      alert.attemptCount += 1;
      alert.lastSeenAt = now;
      alert.path = req.originalUrl;
      alert.userAgent = req.headers['user-agent'];
      alert.blocked = blocked || alert.blocked;
      await alert.save();
      return alert;
    }

    alert = await IpAllowlistAlert.create({
      app: app._id,
      ipAddress: ip,
      path: req.originalUrl,
      userAgent: req.headers['user-agent'],
      blocked,
      firstSeenAt: now,
      lastSeenAt: now
    });

    await this.notifyDeveloper(app, alert);
    return alert;
  }

  static async notifyDeveloper(app, alert) {
    if (alert.notifiedAt) {
      return;
    }

    try {
      const owner = await developerBuilder.findById(app.owner).select('email name');
      if (!owner?.email) {
        return;
      }

      await sendIpAllowlistAlert(owner.email, owner.name, app.name, {
        ipAddress: alert.ipAddress,
        blocked: alert.blocked,
        path: alert.path,
        attemptCount: alert.attemptCount
      });

      alert.notifiedAt = new Date();
      await alert.save();
    } catch (err) {
      console.error('[IP ALLOWLIST] Failed to send notification:', err.message);
    }
  }
}

module.exports = IpAllowlistService;
