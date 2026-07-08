const IpAllowlistService = require('../../services/ipAllowlistService');
const AuditService = require('../../services/auditService');
const { ApiError } = require('../../utils/apiError');

module.exports.getSettings = async (req, res) => {
  const settings = await IpAllowlistService.getSettings(req.appClient._id);
  res.status(200).json(settings);
};

module.exports.updateSettings = async (req, res) => {
  const settings = await IpAllowlistService.updateSettings(req.appClient._id, req.body);

  await AuditService.log('IP_ALLOWLIST_SETTINGS_UPDATED', null, req.appClient._id, req, {
    details: { enabled: settings.enabled, notifyNewIps: settings.notifyNewIps }
  });

  res.status(200).json({
    message: 'IP allowlist settings updated',
    settings
  });
};

module.exports.listEntries = async (req, res) => {
  const entries = await IpAllowlistService.listEntries(req.appClient._id);

  res.status(200).json({
    entries: entries.map((entry) => ({
      id: entry._id,
      value: entry.value,
      label: entry.label,
      isAdminBypass: entry.isAdminBypass,
      createdAt: entry.createdAt
    }))
  });
};

module.exports.addEntry = async (req, res) => {
  const entry = await IpAllowlistService.addEntry(
    req.appClient._id,
    req.user._id,
    req.body
  );

  await AuditService.log('IP_ALLOWLIST_ENTRY_ADDED', null, req.appClient._id, req, {
    details: {
      entryId: entry._id,
      value: entry.value,
      isAdminBypass: entry.isAdminBypass
    }
  });

  res.status(201).json({
    message: 'IP allowlist entry added',
    entry: {
      id: entry._id,
      value: entry.value,
      label: entry.label,
      isAdminBypass: entry.isAdminBypass,
      createdAt: entry.createdAt
    }
  });
};

module.exports.removeEntry = async (req, res) => {
  const entry = await IpAllowlistService.removeEntry(req.appClient._id, req.params.id);

  await AuditService.log('IP_ALLOWLIST_ENTRY_REMOVED', null, req.appClient._id, req, {
    details: { entryId: entry._id, value: entry.value }
  });

  res.status(200).json({ message: 'IP allowlist entry removed' });
};

module.exports.listAlerts = async (req, res) => {
  const alerts = await IpAllowlistService.listAlerts(req.appClient._id, req.query);

  res.status(200).json({
    alerts: alerts.map((alert) => ({
      id: alert._id,
      ipAddress: alert.ipAddress,
      path: alert.path,
      attemptCount: alert.attemptCount,
      blocked: alert.blocked,
      acknowledged: alert.acknowledged,
      notifiedAt: alert.notifiedAt,
      firstSeenAt: alert.firstSeenAt,
      lastSeenAt: alert.lastSeenAt
    }))
  });
};

module.exports.acknowledgeAlert = async (req, res) => {
  const alert = await IpAllowlistService.acknowledgeAlert(req.appClient._id, req.params.id);

  res.status(200).json({
    message: 'Alert acknowledged',
    alert: {
      id: alert._id,
      acknowledged: alert.acknowledged
    }
  });
};

module.exports.checkCurrentIp = async (req, res) => {
  const result = await IpAllowlistService.isRequestAllowed(req, req.appClient);
  const bypass = await IpAllowlistService.shouldBypass(req, req.appClient);

  res.status(200).json({
    ip: IpAllowlistService.normalizeIp(AuditService.getClientIp(req)),
    allowed: result.allowed,
    reason: result.reason,
    bypass: bypass.bypass,
    bypassReason: bypass.reason || null,
    allowlistEnabled: Boolean(req.appClient.ipAllowlistEnabled)
  });
};
