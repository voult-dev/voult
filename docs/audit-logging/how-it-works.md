# How Audit Logging Works in Voult

This document provides a deep dive into the implementation details of the audit logging system in the Voult application.

## Overview

The audit logging system is designed to comprehensively record security-relevant and operational events with minimal performance impact on the main application flow. It follows a fire-and-forget pattern where logging errors don't affect the primary operation.

## Core Components

### 1. Audit Service (`services/auditService.js`)

The central orchestrator of the audit logging process.

### 2. Audit Log Model (`models/auditLog.js`)

Defines the MongoDB schema and indexes for efficient storage and retrieval.

### 3. Supporting Services

- **Risk Assessment Service** (`services/riskAssessmentService.js`) - Evaluates risk
- **Geolocation Service** (`services/geolocationService.js`) - Resolves IP locations
- **Audit Retention Service** (`services/auditRetentionService.js`) - Manages data lifecycle

## Detailed Flow

### Step 1: Initiating an Audit Log Entry

When any part of the application needs to log an auditable event, it calls:

```javascript
AuditService.log(action, userId, appId, req, options)
```

Where:
- `action`: String from predefined enum (e.g., 'LOGIN_SUCCESS')
- `userId`: ObjectId of the user (can be null for system actions)
- `appId`: ObjectId of the application context
- `req`: Express request object (for IP, user agent, etc.)
- `options`: Optional configuration object

### Step 2: IP Address Extraction

```javascript
static getClientIp(req) {
  const rawIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.connection?.remoteAddress
    || req.ip
    || '';

  return GeolocationService.normalizeIp(rawIp);
}
```

This handles various proxy configurations by checking:
1. `X-Forwarded-For` header (first IP in the list)
2. `req.connection.remoteAddress` 
3. `req.ip` (Express-provided)
4. Falls back to empty string

### Step 3: Geolocation Lookup

```javascript
const geolocation = options.geolocation ?? await GeolocationService.lookup(ipAddress);
```

If geolocation isn't provided in options, the service performs an asynchronous lookup using the IP address. Results are cached to avoid repeated lookups for the same IP.

### Step 4: Risk Assessment

```javascript
const assessment = await RiskAssessmentService.assess({
  action,
  status,
  userId,
  appId,
  ipAddress,
  geolocation,
  details: options.details || {}
});
```

The Risk Assessment Service evaluates multiple factors:
- Action type (some actions are inherently riskier)
- Success/failure status
- User context (new vs established user)
- Geographic anomalies
- Velocity/rate anomalies
- Historical patterns

Returns an object with:
- `riskLevel`: LOW, MEDIUM, HIGH, or CRITICAL
- `factors`: Array of strings explaining the assessment

### Step 5: Risk Level Adjustment

```javascript
let riskLevel = assessment.riskLevel;
if (options.riskLevel) {
  riskLevel = RiskAssessmentService.maxRiskLevel(riskLevel, options.riskLevel);
}
```

Callers can override or increase the assessed risk level via options.

### Step 6: Detail Enhancement

```javascript
const details = {
  ...(options.details || {})
};

if (assessment.factors.length > 0) {
  details.riskFactors = assessment.factors;
}
```

Risk factors from the assessment are added to the details for transparency.

### Step 7: Audit Log Creation

```javascript
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
```

All collected information is stored in a new AuditLog document.

### Step 8: Security Alerting

```javascript
if (log.riskLevel === 'HIGH' || log.riskLevel === 'CRITICAL') {
  await this.sendSecurityAlert(log);
}
```

High-risk events trigger immediate notifications (currently console logging).

## Data Model Details

### Schema Definition (`models/auditLog.js`)

```javascript
const AuditLogSchema = new Schema({
    action: {
        type: String,
        enum: [ /* 24 predefined actions */ ],
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EndUser',
        default: null
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
}, { collection: 'auditLogs' });
```

### Indexing Strategy

```javascript
// Indexes for efficient querying
AuditLogSchema.index({ userId: 1, appId: 1, timestamp: -1 });  // User activity
AuditLogSchema.index({ appId: 1, action: 1, timestamp: -1 });  // App-specific actions
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });         // IP investigations
AuditLogSchema.index({ timestamp: -1 });                       // Time-range queries
AuditLogSchema.index({ appId: 1, riskLevel: 1, timestamp: -1 });// Risk monitoring
```

These indexes support the various query patterns used by the application:
- User-specific activity feeds
- Application-level action tracking
- IP-based investigations
- Chronological queries
- Risk-based dashboards

## Query Implementation

### Building Query Filters

```javascript
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
```

This method constructs MongoDB query objects from the API parameters, handling:
- Exact matches for categorical data (userId, action, status, riskLevel)
- IP normalization for consistent matching
- Date range queries using MongoDB's `$gte` and `$lte` operators

### Pagination

```javascript
static getPagination(options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 200);
  const skip = Math.max(parseInt(options.skip, 10) || 0, 0);
  return { limit, skip };
}
```

Ensures reasonable limits (1-200) and prevents negative skip values.

## Retention Implementation

### Configuration Resolution

```javascript
const DEFAULT_RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90', 10);
const RETENTION_INTERVAL_MS = parseInt(
  process.env.AUDIT_LOG_RETENTION_INTERVAL_MS || String(24 * 60 * 60 * 1000),
  10
);
```

### Cutoff Date Calculation

```javascript
function getCutoffDate(retentionDays = getRetentionDays()) {
  return new Date(Date.now() - retentionDays * 24 * 60 * 60 * 10000
### Cleanup Implementation
```javascript
static async purgeExpiredLogs(retentionDays = getRetentionDays * 24 * 60 * 60 * 1000);
}
```

### Deletion Operation

```javascript
static async purgeExpiredLogs(retentionDays = getRetentionDays()) {
  const cutoff = getCutoffDate(retentionDays);
  const result = await AuditLog.deleteMany({ timestamp: { $lt: cutoff } });
  return {
    deletedCount: result.deletedCount,
    cutoff,
    retentionDays
  };
}
```

Uses MongoDB's `deleteMany` with a timestamp comparison for efficient bulk deletion.

### Scheduling

```javascript
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

  run(); // Initial run
  return setInterval(run, RETENTION_INTERVAL_MS);
}
```

The job runs immediately on startup and then at the configured interval.

## Risk Assessment Algorithm

While the detailed implementation is in `riskAssessmentService.js`, the key factors considered include:

### Action-Based Risk
- Authentication failures: MEDIUM-HIGH
- Privilege escalation attempts: HIGH
- Account modifications: MEDIUM
- Bulk operations: LOW-MEDIUM

### Context-Based Risk
- New vs established users
- Geographic impossibilities (impossible travel)
- Unusual access times
- Device/browser anomalies

### Behavioral Risk
- Failed attempt velocity
- Unusual action sequences
- Deviation from historical patterns

The service uses weighted scoring to determine the final risk level.

## Error Handling and Resilience

The audit service is designed to never fail the primary operation:

```javascript
try {
  // All logging logic...
} catch (err) {
  console.error('Audit logging failed:', err);
  // Operation continues normally
}
```

This ensures that even if logging fails completely (database down, etc.), the primary application functionality remains unaffected.

## Performance Optimizations

1. **Asynchronous Operations**: IP geolocation and risk assessment are async but don't block the main flow
2. **Connection Pooling**: Uses MongoDB connection pooling for efficient database access
3. **Index Utilization**: All queries leverage appropriate indexes
4. **Geolocation Caching**: Prevents redundant external API calls
5. **Bulk Operations**: Retention uses efficient bulk delete operations

## Security Considerations

1. **Immutability**: Audit logs are append-only; updates/deletes only happen via retention policy
2. **Integrity**: While not cryptographically signed, the system ensures complete capture
3. **Access Control**: API endpoints require appropriate authentication/authorization
4. **PII Minimization**: Effort made to avoid storing sensitive data in audit fields
5. **Tamper Evidence**: Consistent logging makes gaps noticeable

## Extension Points

The system is designed to be extensible:

1. **New Actions**: Add to the enum in the AuditLog schema
2. **Enhanced Risk Factors**: Modify RiskAssessmentService
3. **Additional Fields**: Extend the AuditLog schema
4. **Alternative Storage**: Modify AuditService.log() implementation
5. **Different Alerting**: Update sendSecurityAlert() method

## Monitoring and Debugging

### Logging
- Successful audit logs: Silent (fire-and-forget)
- Failed audit logs: Error-level console output
- Security alerts: Warning-level console output
- Retention operations: Info-level console output

### Metrics
While not explicitly implemented in this codebase, potential metrics include:
- Audit events per second
- Risk level distribution
- Retention effectiveness
- Geolocation lookup performance
- Database operation latencies

## Best Practices for Consumers

When adding audit logs to new features:

1. **Choose Appropriate Actions**: Select from existing actions or add new ones to the enum
2. **Provide Context**: Use the `details` field for relevant contextual information
3. **Honor Results**: Always pass the actual success/failure status
4. **Consider Risk**: Let the system assess risk, but override when you have special knowledge
5. **Avoid Sensitive Data**: Never put passwords, tokens, or PII in audit logs
6. **Be Consistent**: Use the same actions for the same types of events across the codebase

## Troubleshooting

### Missing Logs
1. Check if AuditService.log() is being called
2. Verify database connectivity
3. Check application logs for audit errors
4. Confirm the appId is valid

### Performance Issues
1. Ensure database indexes are properly built
2. Check geolocation service performance
3. Review retention frequency vs. volume
4. Monitor query patterns against indexes

### Incorrect Risk Levels
1. Review RiskAssessmentService logic
2. Check if options.riskLevel is overriding assessments
3. Verify input data (particularly IP addresses and user history)