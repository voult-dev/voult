# Secret Rotation Procedure

This document outlines the team procedure for rotating secrets in the voult.dev application.

## When to Rotate Secrets

- JWT secrets: Every 90 days
- Session secrets: Every 90 days  
- Refresh token secrets: Every 90 days
- Encryption keys: Every 180 days

The application automatically warns when secrets are approaching the 90-day rotation threshold.

## Rotation Steps

### 1. Generate New Secret

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use the SecretService programmatically:

```javascript
const { getSecretService } = require('./src/secrets/secretService');
const secretService = getSecretService();
const { newSecret, versionedKey, version } = secretService.rotateSecret('ENDUSER_JWT_SECRET');
console.log(`${versionedKey}=${newSecret}`);
```

### 2. Update .env File

Add the new versioned secret to `.env`:

```
ENDUSER_JWT_SECRET_V2=<new_secret_value>
```

When using versioned secrets, update the `secrets.json` file to reflect the new version number.

### 3. Update secrets.json

The VersionTracker automatically updates `src/secrets/secrets.json` with:
- New version number
- Rotation timestamp
- Updated at timestamp

### 4. Restart Application

Restart the application to pick up the new secret. The SecretService will automatically use the highest versioned key.

### 5. Update External Services

If the secret is used by external services (OAuth providers, API integrations), update those services with the new value.

### 6. Remove Old Secret (Optional)

After confirming the new secret works, you may remove the old versioned key from `.env`:

```
# Remove this line after rotation is complete:
ENDUSER_JWT_SECRET_V1=<old_secret_value>
```

## Emergency Rotation

If a secret is compromised:

1. Immediately generate a new secret
2. Update `.env` with the new value
3. Restart the application
4. Revoke all active sessions/tokens
5. Notify affected users
6. Audit logs for suspicious activity

## Verification

After rotation, verify:

```javascript
// Check that the new secret is loaded
const secret = secretService.getSecret('ENDUSER_JWT_SECRET');
console.log('Secret length:', secret.length); // Should be >= 32
```

## Secret Manager Usage

Use `SecretService` instead of direct `process.env` access:

```javascript
const { getSecretService } = require('./src/secrets/secretService');
const secretService = getSecretService();

// Get current secret
const jwtSecret = secretService.getSecret('ENDUSER_JWT_SECRET');

// Check rotation status
const needsRotation = secretService.checkAllSecretsRotation(90);
```