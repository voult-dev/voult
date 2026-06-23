

const AuditLog = require('../models/auditLog');

class AuditService {
    static async log(action, userId, appId, req, options = {}) {
        try {
            const log = new AuditLog({
                action,
                userId,
                appId,
                ipAddress: this.getClientIp(req),
                userAgent: req.headers['user-agent'],
                details: options.details || {},
                status: options.status || 'SUCCESS',
                riskLevel: options.riskLevel || this.assessRiskLevel(action),
                geolocation: options.geolocation
            });
            
            await log.save();
            
            // Alert on high-risk actions
            if (log.riskLevel === 'HIGH' || log.riskLevel === 'CRITICAL') {
                await this.sendSecurityAlert(log);
            }
            
            return log;
        } catch (err) {
            console.error('Audit logging failed:', err);
            // Don't throw - logging shouldn't break the app
        }
    }
    
    static getClientIp(req) {
        return req.headers['x-forwarded-for']?.split(',')[0] 
            || req.connection.remoteAddress 
            || req.ip;
    }
    
    static assessRiskLevel(action) {
        const highRiskActions = [
            'PASSWORD_CHANGE',
            'PASSWORD_RESET',
            'ACCOUNT_DISABLED',
            'OAUTH_UNLINK',
            'TOKEN_REVOKED'
        ];
        
        if (highRiskActions.includes(action)) {
            return 'HIGH';
        }
        
        return 'LOW';
    }
    
    static async sendSecurityAlert(log) {
        // TODO: Send alert email or SMS
        console.warn(`🚨 Security Alert: ${log.action} by user ${log.userId}`);
    }
    
    static async getAuditTrail(userId, appId, options = {}) {
        const query = { userId, appId };
        
        if (options.startDate || options.endDate) {
            query.timestamp = {};
            if (options.startDate) query.timestamp.$gte = options.startDate;
            if (options.endDate) query.timestamp.$lte = options.endDate;
        }
        
        return AuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(options.limit || 50)
            .skip(options.skip || 0);
    }
}

module.exports = AuditService;