# Audit Logging System Documentation

This document explains how the audit logging system works in the Voult application.

## Overview

The audit logging system in Voult provides comprehensive security and compliance logging for all significant user and system activities. It captures detailed information about user actions, system events, and security-related events for monitoring, auditing, and forensic analysis.

## Key Components

1. **Audit Log Model** (`models/auditLog.js`) - Defines the data structure and database indexes
2. **Audit Service** (`services/auditService.js`) - Core logging functionality, risk assessment, and querying
3. **Audit Log Controller** (`controllers/api/auditLog.js`) - API endpoints for accessing audit logs
4. **Audit Retention Service** (`services/auditRetentionService.js`) - Automatic cleanup of old logs

## Table of Contents

- [Overview](#overview)
- [Audit Log Model](#audit-log-model)
- [Audit Service](#audit-service)
  - [Logging Process](#logging-process)
  - [Risk Assessment](#risk-assessment)
  - [Security Alerts](#security-alerts)
  - [Querying and Filtering](#querying-and-filtering)
- [Audit Retention](#audit-retention)
- [API Endpoints](#api-endpoints)
- [Risk Levels](#risk-levels)
- [Audit Actions](#audit-actions)

---

## Audit Log Model

The audit log model (`models/auditLog.js`) defines what information is stored for each audit event:

### Fields

- **action**: The type of action performed (enum of predefined actions)
- **userId**: Reference to the user who performed the action (can be null for system actions)
- **appId**: Reference to the application the action occurred in
- **ipAddress**: IP address where the action originated
- **userAgent**: Browser/user agent string
- **details**: Additional context-specific information (flexible JSON object)
- **status**: Outcome of the action (SUCCESS, FAILURE, PENDING)
- **riskLevel**: Assessed risk level (LOW, MEDIUM, HIGH, CRITICAL)
- **geolocation**: Geographic location derived from IP address
- **timestamp**: When the action occurred (indexed for performance)

### Database Indexes

The schema includes several indexes for efficient querying:
- `{ userId: 1, appId: 1, timestamp: -1 }` - User activity tracking
- `{ appId: 1, action: 1, timestamp: -1 }` - App-specific action tracking
- `{ ipAddress: 1, timestamp: -1 }` - IP-based investigations
- `{ timestamp: -1 }` - Time-based queries
- `{ appId: 1, riskLevel: 1, timestamp: -1 }` - Risk-based monitoring

---

## Audit Service

The core logging functionality resides in `services/auditService.js`.

### Logging Process

When an action needs to be logged, the `AuditService.log()` method is called with:

1. **Action**: The type of action being performed
2. **User ID**: ID of the user performing the action (optional)
3. **App ID**: ID of the application where the action occurred
4. **Request Object**: HTTP request object (for IP, user agent, etc.)
5. **Options**: Additional options (status, risk level, details, etc.)

The logging process follows these steps:

1. Extract IP address from request (handling proxies via X-Forwarded-For)
2. Perform geolocation lookup on the IP address
3. Assess risk using the RiskAssessmentService
4. Create an AuditLog document with all collected information
5. Save to MongoDB
6. Trigger security alerts for HIGH/CRITICAL risk events

### Risk Assessment

The service uses `RiskAssessmentService` to evaluate the risk level of each action based on:
- Action type
- Status (success/failure)
- User ID
- Application ID
- IP address
- Geolocation
- Action-specific details

Risk levels can be manually overridden or increased via the `options.riskLevel` parameter.

### Security Alerts

When an audit log entry is assessed as HIGH or CRITICAL risk, the system automatically triggers a security alert by logging a warning message to the console.

### Querying and Filtering

The AuditService provides several methods for querying audit logs:

- `queryLogs(appId, options)` - General purpose querying with filtering and pagination
- `getAuditTrail(userId, appId, options)` - Get audit trail for a specific user
- `queryByIp(appId, ipAddress, options)` - Find all actions from a specific IP
- `queryByAction(appId, action, options)` - Find all actions of a specific type
- `queryHighRiskEvents(appId, options)` - Get only HIGH and CRITICAL risk events
- `getSecuritySummary(appId, options)` - Get statistical summary of audit events

All query methods support filtering by:
- User ID
- Action type
- Status
- Risk level
- IP address
- Date range
- Pagination (limit/skip)

---

## Audit Retention

The audit retention service (`services/auditRetentionService.js`) automatically removes old audit logs to comply with data retention policies.

### Configuration

Controlled by environment variables:
- `AUDIT_LOG_RETENTION_DAYS`: Number of days to retain logs (default: 90)
- `AUDIT_LOG_RETENTION_INTERVAL_MS`: How often to run cleanup (default: 24 hours)
- `AUDIT_LOG_RETENTION_ENABLED`: Enable/disable retention job (default: true)

### Process

The retention service:
1. Runs on a scheduled interval (default: daily)
2. Calculates a cutoff date based on retention days
3. Deletes all audit logs older than the cutoff date
4. Logs the number of deleted records

### API Endpoint

The retention policy can be inspected via:
- `GET /api/app/logs/retention` - Returns retention configuration

---

## API Endpoints

The audit logging system provides several API endpoints through `controllers/api/auditLog.js`:

### GET `/api/app/logs`
Query application audit logs with filtering and pagination

**Query Parameters:**
- `userId`: Filter by user ID
- `action`: Filter by action type
- `status`: Filter by outcome (SUCCESS/FAILURE/PENDING)
- `riskLevel`: Filter by risk level
- `ipAddress`: Filter by IP address
- `startDate`: Start of date range (ISO string)
- `endDate`: End of date range (ISO string)
- `limit`: Maximum results to return (default: 50, max: 200)
- `skip`: Number of results to skip (for pagination)
- `minRiskLevel`: Minimum risk level to include

### GET `/api/app/logs/summary`
Get security summary statistics for the application

**Query Parameters:**
- `startDate`: Start of date range (ISO string)
- `endDate`: End of date range (ISO string)

**Returns:**
- Time window analyzed
- Event totals and breakdowns by action, risk level, and status
- Recent high-risk events

### GET `/app/logs/high-risk`
Get high-risk (HIGH/CRITICAL) audit events

**Query Parameters:**
- Same as `/api/app/logs` plus:
- `minRiskLevel`: Minimum risk level to include (default: HIGH)

### GET `/api/app/logs/my`
Get audit trail for the currently authenticated user

**Requires authentication**
**Query Parameters:**
- Same as `/api/app/logs`

### GET `/api/app/logs/retention`
Get current audit log retention policy

**Returns:**
- `retentionDays`: Number of days logs are retained
- `cutoffDate`: Date before which logs will be deleted
- `geolocationEnabled`: Whether IP geolocation is enabled
- `retentionEnabled`: Whether automatic retention is enabled

---

## Risk Levels

Audit events are assigned one of four risk levels:

- **LOW**: Normal, expected operations
- **MEDIUM**: Moderately unusual activity requiring attention
- **HIGH**: Potentially malicious activity requiring immediate attention
- **CRITICAL**: Definitely malicious activity requiring immediate investigation

Risk levels are determined by the RiskAssessmentService based on factors like:
- Unusual geographic locations
- Failed authentication attempts
- Privilege escalation attempts
- Unusual access patterns

## Audit Actions

The system tracks these specific actions:

### Authentication
- `LOGIN_SUCCESS`
- `LOGIN_FAILURE`
- `LOGIN_ATTEMPT_THROTTLED`
- `REGISTER`
- `PASSWORD_CHANGE`
- `PASSWORD_RESET`
- `EMAIL_VERIFIED`

### Account Management
- `ACCOUNT_DISABLED`
- `ACCOUNT_ENABLED`

### OAuth
- `OAUTH_LOGIN`
- `OAUTH_LINK`
- `OAUTH_UNLINK`
- `TOKEN_REVOKED`

### Sessions
- `SESSION_CREATED`
- `SESSION_REVOKED`

---

## Implementation Details

### Geolocation

IP addresses are resolved to geographic coordinates using an external geolocation service. Results are cached to improve performance.

### Performance Considerations

- Database indexes are optimized for common query patterns
- Geolocation results are cached to reduce external API calls
- Audit writes are fire-and-forget (errors are logged but don't block the main operation)
- High-risk events trigger asynchronous alerts

### Security Considerations

- Audit logs themselves are append-only and immutable
- Failed audit logging attempts are logged to console but don't fail the primary operation
- Sensitive data should never be stored in the `details` field
- IP addresses are stored for security investigations but may be masked in logs based on configuration

---

## Usage Examples

### Logging an Action

```javascript
const AuditService = require('./services/auditService');

// In your route handler or service:
AuditService.log(
  'PASSWORD_CHANGE',           // action
  req.user._id,               // userId
  req.appClient._id,          // appId
  req,                        // request object
  {
    status: 'SUCCESS',
    details: { 
      passwordChangedAt: new Date(),
      ipChangedFrom: req.ip 
    }
  }
);
```

### Querying Audit Logs

```javascript
const AuditService = require('./services/auditService');

// Get recent failed logins for an application
const failedLogins = await AuditService.queryLogs(appId, {
  action: 'LOGIN_FAILURE',
  status: 'FAILURE',
  limit: 50
});

// Get security summary for last 7 days
const summary = await AuditService.getSecuritySummary(appId, {
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
});
```

---

## Configuration

The audit logging system can be configured via environment variables:

- `AUDIT_LOG_RETENTION_DAYS`: Days to retain logs (default: 90)
- `AUDIT_LOG_RETENTION_INTERVAL_MS`: Cleanup interval in milliseconds (default: 86400000 = 24 hours)
- `AUDIT_LOG_RETENTION_ENABLED`: Enable/disable automatic cleanup (default: true)
- `AUDIT_GEOLOCATION_ENABLED`: Enable/disable IP geolocation (default: true)

---

## Maintenance

### Manual Log Cleanup

To manually trigger log cleanup:
```javascript
const AuditRetentionService = require('./services/auditRetentionService');
const result = await AuditRetentionService.purgeExpiredLogs();
console.log(`Deleted ${result.deletedCount} logs older than ${result.retentionDays} days`);
```

### Monitoring

High-risk events are automatically logged to the console as warnings:
```
Security Alert: PASSWORD_CHANGE [CRITICAL] user=12345 app=67890
```

For production deployments, consider forwarding these alerts to a SIEM or monitoring system.