const AuditService = require('../../services/auditService');

jest.mock('../../models/auditLog', () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  deleteMany: jest.fn()
}));

const AuditLog = require('../../models/auditLog');
const AuditRetentionService = require('../../services/auditRetentionService');

describe('AuditService query helpers', () => {
  test('buildQueryFilters applies normalized IP and date range', () => {
    const query = AuditService.buildQueryFilters('507f1f77bcf86cd799439011', {
      ipAddress: '::ffff:203.0.113.10',
      action: 'LOGIN_FAILURE',
      startDate: '2026-01-01',
      endDate: '2026-01-31'
    });

    expect(query.appId).toBe('507f1f77bcf86cd799439011');
    expect(query.ipAddress).toBe('203.0.113.10');
    expect(query.action).toBe('LOGIN_FAILURE');
    expect(query.timestamp.$gte).toEqual(new Date('2026-01-01'));
    expect(query.timestamp.$lte).toEqual(new Date('2026-01-31'));
  });

  test('getPagination clamps limit and skip', () => {
    expect(AuditService.getPagination({ limit: '500', skip: '-3' })).toEqual({
      limit: 200,
      skip: 0
    });
  });
});

describe('AuditRetentionService', () => {
  test('getRetentionDays falls back to 90 for invalid env values', () => {
    const original = process.env.AUDIT_LOG_RETENTION_DAYS;
    process.env.AUDIT_LOG_RETENTION_DAYS = 'not-a-number';
    jest.resetModules();
    jest.mock('../../models/auditLog', () => ({
      deleteMany: jest.fn()
    }));
    const Retention = require('../../services/auditRetentionService');
    expect(Retention.getRetentionDays()).toBe(90);
    process.env.AUDIT_LOG_RETENTION_DAYS = original;
  });

  test('purgeExpiredLogs deletes records older than retention window', async () => {
    AuditLog.deleteMany.mockResolvedValue({ deletedCount: 4 });

    const result = await AuditRetentionService.purgeExpiredLogs(30);

    expect(result.deletedCount).toBe(4);
    expect(result.retentionDays).toBe(30);
    expect(AuditLog.deleteMany).toHaveBeenCalledWith({
      timestamp: { $lt: expect.any(Date) }
    });
  });
});
