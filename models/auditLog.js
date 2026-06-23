const mongoose = require('mongoose');
const { Schema } = mongoose;

const AuditLogSchema = new Schema(
    {
        action: {
            type: String,
            enum: [
                'LOGIN_SUCCESS',
                'LOGIN_FAILURE',
                'LOGIN_ATTEMPT_THROTTLED',
                'REGISTER',
                'PASSWORD_CHANGE',
                'PASSWORD_RESET',
                'EMAIL_VERIFIED',
                'ACCOUNT_DISABLED',
                'ACCOUNT_ENABLED',
                'OAUTH_LOGIN',
                'OAUTH_LINK',
                'OAUTH_UNLINK',
                'TOKEN_REVOKED',
                'SESSION_CREATED',
                'SESSION_REVOKED'
            ],
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EndUser',
            required: true
        },
        appId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'App',
            required: true
        },
        ipAddress: {
            type: String,
            required: true
        },
        userAgent: {
            type: String
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILURE', 'PENDING'],
            default: 'SUCCESS'
        },
        riskLevel: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            default: 'LOW'
        },
        geolocation: {
            country: String,
            city: String,
            coordinates: {
                latitude: Number,
                longitude: Number
            }
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    { collection: 'auditLogs' }
);

// Indexes for efficient querying
AuditLogSchema.index({ userId: 1, appId: 1, timestamp: -1 });
AuditLogSchema.index({ appId: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);