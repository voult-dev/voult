const RiskAssessmentService = require('../../services/riskAssessmentService');

describe('RiskAssessmentService', () => {
  test('maxRiskLevel returns the higher risk level', () => {
    expect(RiskAssessmentService.maxRiskLevel('LOW', 'HIGH')).toBe('HIGH');
    expect(RiskAssessmentService.maxRiskLevel('CRITICAL', 'MEDIUM')).toBe('CRITICAL');
  });

  test('assess elevates repeated IP failures', async () => {
    const AuditLog = require('../../models/auditLog');
    jest.spyOn(AuditLog, 'countDocuments').mockResolvedValue(6);
    jest.spyOn(AuditLog, 'findOne').mockReturnValue({
      sort: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      })
    });
    jest.spyOn(AuditLog, 'exists').mockResolvedValue(true);

    const result = await RiskAssessmentService.assess({
      action: 'LOGIN_FAILURE',
      status: 'FAILURE',
      userId: null,
      appId: '507f1f77bcf86cd799439011',
      ipAddress: '203.0.113.10',
      details: { reason: 'INVALID_PASSWORD' }
    });

    expect(result.riskLevel).toBe('HIGH');
    expect(result.factors).toContain('REPEATED_IP_FAILURES');

    jest.restoreAllMocks();
  });

  test('assess flags impossible travel on rapid country change', async () => {
    const AuditLog = require('../../models/auditLog');
    jest.spyOn(AuditLog, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AuditLog, 'findOne').mockReturnValue({
      sort: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          geolocation: { country: 'Canada' },
          timestamp: new Date(Date.now() - 30 * 60 * 1000)
        })
      })
    });
    jest.spyOn(AuditLog, 'exists').mockResolvedValue(true);

    const result = await RiskAssessmentService.assess({
      action: 'LOGIN_SUCCESS',
      status: 'SUCCESS',
      userId: '507f1f77bcf86cd799439012',
      appId: '507f1f77bcf86cd799439011',
      ipAddress: '203.0.113.10',
      geolocation: { country: 'Germany' },
      details: {}
    });

    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.factors).toContain('IMPOSSIBLE_TRAVEL');

    jest.restoreAllMocks();
  });
});
