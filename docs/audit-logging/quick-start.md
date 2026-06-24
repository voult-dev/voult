# Audit Logging Quick Start Guide

This guide shows developers how to add audit logging to their application features in the Voult codebase.

## Basic Usage

### 1. Import the Audit Service

```javascript
const AuditService = require('../../services/auditService');
```

### 2. Log an Action

Add this code where you want to record an auditable event:

```javascript
AuditService.log(
  'ACTION_NAME',           // Required: action from the predefined list
  userId,                  // Optional: ObjectId of the user (can be null)
  appId,                   // Required: ObjectId of the application
  req,                     // Required: Express request object
  {                        // Optional: additional options
    status: 'SUCCESS',     // SUCCESS, FAILURE, or PENDING
    riskLevel: 'HIGH',     // Optional: override risk assessment
    details: {             // Optional: context-specific information
      key: 'value',
      // ... other relevant data
    }
  }
);
```

### 3. Handle the Promise (Optional)

The `log` method returns a Promise that resolves to the saved audit log document:

```javascript
try {
  const logEntry = await AuditService.log(
    'PASSWORD_CHANGE',
    user._id,
    app._id,
    req,
    {
      status: 'SUCCESS',
      details: { 
        changedAt: new Date(),
        ip: req.ip
      }
    }
  );
  
  // logEntry contains the saved audit document
  console.log('Audit logged:', logEntry._id);
} catch (err) {
  // Logging failed, but your operation should continue
  console.error('Failed to write audit log:', err);
  // Don't re-throw - the main operation should still succeed
}
```

## Common Examples

### Authentication Events

```javascript
// Successful login
AuditService.log(
  'LOGIN_SUCCESS',
  user._id,
  app._id,
  req,
  {
    status: 'SUCCESS',
    details: {
      loginMethod: 'password',
      deviceFingerprint: 'abc123'
    }
  }
);

// Failed login
AuditService.log(
  'LOGIN_FAILURE',
  null, // No user yet
  app._id,
  req,
  {
    status: 'FAILURE',
    details: {
      attemptedEmail: email,
      reason: 'invalid_password'
    }
  }
);
```

### Account Management

```javascript
// Password change
AuditService.log(
  'PASSWORD_CHANGE',
  user._id,
  app._id,
  req,
  {
    status: 'SUCCESS',
    details: {
      changedAt: new Date(),
      requireLoginAgain: true
    }
  }
);

// Account disable
AuditService.log(
  'ACCOUNT_DISABLED',
  adminUser._id, // Who performed the action
  app._id,
  req,
  {
    status: 'SUCCESS',
    details: {
      reason: 'terms_violation',
      disabledAccountId: targetUser._id
    }
  }
);
```

### OAuth Operations

```javascript
// OAuth login
AuditService.log(
  'OAUTH_LOGIN',
  user._id,
  app._id,
  req,
  {
    status: 'SUCCESS',
    details: {
      provider: 'google',
      email: profile.email
    }
  }
);

// Token revocation
AuditService.log(
  'TOKEN_REVOKED',
  user._id,
  app._id,
  req,
  {
    status: 'SUCCESS',
    details: {
      tokenType: 'refreshTokenId: revokedToken._id
  }
);
```

### Administrative Actions

```javascript
// Session revocation (admin action)
AuditService.log(
  'SESSION_REVOKED',
  adminUser._id,
  app._id,
  req,
  {
    status: 'SUCCESS',
    details: {
      reason: 'security_incident',
      revokedSessionsCount: 5,
      targetUserId: compromisedUser._id
    }
  }
);
```

## Best Practices

### 1. Choose the Right Action
Select from the predefined actions in `models/auditLog.js`:
- Authentication: LOGIN_SUCCESS, LOGIN_FAILURE, REGISTER, etc.
- Account: PASSWORD_CHANGE, ACCOUNT_DISABLED, ACCOUNT_ENABLED
- OAuth: OAUTH_LOGIN, OAUTH_LINK, OAUTH_UNLINK, TOKEN_REVOKED
- Sessions: SESSION_CREATED, SESSION_REVOKED

If you need a new action, add it to the enum in the AuditLog schema.

### 2. Provide Meaningful Details
The `details` field should contain information that would be useful for:
- Debugging issues
- Investigating security incidents
- Understanding user behavior
- Compliance reporting

**Good examples:**
```javascript
details: {
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  resourceId: 'res_123',
  actionType: 'export',
  recordCount: 150
}
```

**Avoid:**
```javascript
// Don't put sensitive information here!
details: {
  password: 'secret123',      // NEVER DO THIS
  token: 'secret_token',      // NEVER DO THIS
  ssn: '123-45-6789'         // NEVER DO THIS
}
```

### 3. Let the System Assess Risk
Unless you have specific knowledge that changes the risk assessment, let the RiskAssessmentService determine the risk level:

```javascript
// Good - let system decide
AuditService.log('LOGIN_FAILURE', userId, appId, req, {
  status: 'FAILURE'
});

// Only override when you know better
AuditService.log('LOGIN_FAILURE', userId, appId, req, {
  status: 'FAILURE',
  riskLevel: 'CRITICAL' // Only if you know this is part of an attack
});
```

### 4. Always Pass the Request Object
The request object is needed to extract:
- IP address (with proper proxy handling)
- User agent
- Other request-specific context

```javascript
// Always pass req
AuditService.log(action, userId, appId, req, options);

// Never do this - you'll lose important context
AuditService.log(action, userId, appId, null, options);
```

### 5. Handle Logging Failures Gracefully
Never let audit logging failures affect your main operation:

```javascript
// CORRECT - logging failures don't break the main flow
try {
  await AuditService.log(...);
  // Continue with main operation
} catch (logErr) {
  console.warn('Audit logging failed:', logErr);
  // Continue anyway
}

// INCORRECT - don't let logging failures affect primary operation
try {
  await AuditService.log(...);
  await mainOperation();
} catch (err) {
  // This would fail the main operation if logging fails!
  throw err;
}
```

## Advanced Usage

### Providing Pre-computed Geolocation
If you already have geolocation data, you can provide it to avoid an extra lookup:

```javascript
// If you already have geo data from elsewhere
const geoData = await someGeoService.lookup(ip);

AuditService.log(
  'SUSPICIOUS_LOGIN',
  userId,
  appId,
  req,
  {
    status: 'FAILURE',
    geolocation: geoData, // Provide pre-lookup data
    details: {
      loginAttempt: true,
      geoMatch: false
    }
  }
);
```

### Overriding Risk Assessment
When you have special knowledge about risk:

```javascript
// Known bad IP range - force HIGH risk
AuditService.log(
  'LOGIN_ATTEMPT',
  userId,
  appId,
  req,
  {
    status: 'FAILURE',
    riskLevel: 'HIGH', // Override normal assessment
    details: {
      ipReputation: 'malicious',
      threatFeedMatch: true
    }
  }
);
```

### Bulk Operations
For efficiency when logging multiple related events:

```javascript
// Log multiple related actions
const logPromises = [
  AuditService.log('SESSION_CREATED', userId, appId, req, { 
    details: { sessionId: sess1._id } 
  }),
  AuditService.log('TOKEN_ISSUED', userId, appId, req, { 
    details: { tokenType: 'access', tokenId: tok1._id } 
  }),
  AuditService.log('TOKEN_ISSUED', userId, appId, req, { 
    details: { tokenType: 'refresh', tokenId: tok2._id } 
  })
];

// Wait for all to complete (optional)
await Promise.allSettled(logPromises);
```

## Testing Your Audit Logs

### Verifying Logs Were Created
```javascript
// After performing an action that should be logged
const logs = await AuditService.queryLogs(appId, {
  action: 'EXPECTED_ACTION',
  userId: user._id,
  limit: 1
});

expect(logs.logs.length).toBe(1);
expect(logs.logs[0].action).toBe('EXPECTED_ACTION');
expect(logs.logs[0].userId.toString()).toBe(user._id.toString());
```

### Testing Risk Assessment
```javascript
// Test that risky actions get appropriate risk levels
const logs = await AuditService.queryLogs(appId, {
  action: 'LOGIN_FAILURE',
  minRiskLevel: 'MEDIUM',
  limit: 10
});

// Should find some medium+ risk failed logins
expect(logs.total).toBeGreaterThan(0);
```

## Common Mistakes to Avoid

### 1. Forgetting the Request Object
```javascript
// ❌ WRONG - loses IP and user agent
AuditService.log(action, userId, appId, null, options);

// ✅ CORRECT
AuditService.log(action, userId, appId, req, options);
```

### 2. Storing Sensitive Data
```javascript
// ❌ WRONG - never store passwords, tokens, etc.
AuditService.log(action, userId, appId, req, {
  details: {
    password: plainTextPassword, // NEVER DO THIS
    secretKey: apiKey           // NEVER DO THIS
  }
});

// ✅ CORRECT - only store non-sensitive context
AuditService.log(action, userId, appId, req, {
  details: {
    attemptCount: 3,
    resourceType: 'document',
    actionResult: 'partial_success'
  }
});
```

### 3. Not Handling Errors
```javascript
// ❌ WRONG - logging errors break your feature
await AuditService.log(action, userId, appId, req, options);
// If this throws, your feature breaks

// ✅ CORRECT - handle logging errors gracefully
try {
  await AuditService.log(action, userId, appId, req, options);
} catch (e) {
  console.warn('Audit logging failed:', e);
  // Continue with your feature
}
```

### 4. Using Wrong Action Types
```javascript
// ❌ WRONG - not a valid action
AuditService.log('USER_CLICKED_BUTTON', userId, appId, req, options);

// ✅ CORRECT - use defined actions or add new ones properly
AuditService.log('PAGE_VIEW', userId, appId, req, options);
// Or add 'BUTTON_CLICK' to the enum in models/auditLog.js
```

## Verification Checklist

Before considering your audit logging implementation complete, verify:

- [ ] You're importing `AuditService` correctly
- [ ] You're passing the Express `req` object
- [ ] You're using valid action types from the enum
- [ ] You're not storing sensitive data in `details`
- [ ] You're handling logging errors without affecting your main logic
- [ ] You're providing meaningful context in the `details` field
- [ ] You're letting the system assess risk unless you have specific override knowledge
- [ ] You've tested both success and failure paths (if applicable)

## Need Help?

If you're unsure about:
- Which action type to use
- What information is appropriate for the `details` field
- How to interpret risk assessments
- Whether to override risk levels

Consult with a team member familiar with the audit system or check existing implementations in the codebase for similar functionality.