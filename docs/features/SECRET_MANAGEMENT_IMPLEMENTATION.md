# Secret Management Implementation

This document describes how the secret management system has been integrated into the voult.dev codebase.

## Implementation Overview

The secret management system follows a layered architecture with three core components:

### 1. SecretGenerator (`src/secrets/secretGenerator.js`)

Generates cryptographically strong secrets using Node.js built-in `crypto` module.

```javascript
const { generateSecret, isStrongSecret } = require('./secrets/secretGenerator');
const secret = generateSecret(32); // Returns 32-character hex string
```

Features:
- Uses `crypto.randomBytes()` for CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
- Generates minimum 32-character secrets
- Validates entropy for cryptographic strength

### 2. VersionTracker (`src/secrets/versionTracker.js`)

Tracks secret versions and rotation dates in `src/secrets/secrets.json`.

```javascript
const VersionTracker = require('./secrets/versionTracker');
const tracker = new VersionTracker();

// Get current version
const version = tracker.getVersion('ENDUSER_JWT_SECRET');

// Rotate secret
tracker.rotateSecret('ENDUSER_JWT_SECRET');

// Check rotation status
const days = tracker.getDaysSinceRotation('ENDUSER_JWT_SECRET');
```

Features:
- JSON-based version tracking (no plain text secrets stored)
- Automatic rotation date calculation
- Identifies secrets needing rotation

### 3. SecretService (`src/secrets/secretService.js`)

Centralized secret access with singleton pattern.

```javascript
const { getSecretService } = require('./secrets/secretService');
const secretService = getSecretService();

// Initialize at startup
secretService.initialize(['ENDUSER_JWT_SECRET', 'SESSION_SECRET']);

// Get secret (supports versioned keys)
const secret = secretService.getSecret('ENDUSER_JWT_SECRET');
```

Features:
- Singleton pattern prevents multiple instances
- Validates secrets at initialization
- Supports versioned secret keys (V1, V2, etc.)
- Throws on missing/invalid secrets

## Application Integration

### Entry Point (`src/index.js`)

The application startup now initializes the SecretService:

```javascript
const { SecretService, getSecretService } = require('./secrets/secretService');
const secretService = getSecretService();

const secretsToTrack = [
  'ENDUSER_JWT_SECRET',
  'SESSION_SECRET',
  'REFRESH_TOKEN_SECRET'
];

try {
    secretService.initialize(secretsToTrack);
    validateSecrets(); // From config/secrets.js
} catch (err) {
    console.error('Fatal Error:', err.message);
    process.exit(1);
}
```

### Secret Validation (`config/secrets.js`)

Updated to:
- Import `isStrongSecret` from SecretGenerator
- Support versioned keys (e.g., `SECRET_V1`)
- Validate secrets at startup before application runs

## .env File Updates

Secrets can be stored in two formats:
1. Base key (for current version): `SECRET_NAME=value`
2. Versioned key (for explicit versioning): `SECRET_NAME_V1=value`

The system checks both formats for backward compatibility:

```
SESSION_SECRET_V1=385caca129db7969f797f25e9e2764189494bc34ad75c15cd562e57650c8a672
JWT_SECRET_V1=6de464dc995ac3bdf119ff8254481b11f822cfb7117fb34beaf2049e51c84ded
```

## Secrets Metadata (`src/secrets/secrets.json`)

```json
{
  "secrets": {
    "ENDUSER_JWT_SECRET": {
      "version": 1,
      "rotationDates": ["2026-05-13T00:00:00.000Z"],
      "createdAt": "2026-05-13T00:00:00.000Z",
      "updatedAt": "2026-05-13T00:00:00.000Z"
    }
  },
  "_metadata": {
    "rotationIntervalDays": 90,
    "minimumSecretLength": 32
  }
}
```

## How It Works

### Application Startup Flow

1. `dotenv.config()` loads `.env` file
2. `SecretService.initialize()` registers and validates all tracked secrets
3. `validateSecrets()` performs additional validation on required secrets (from `config/secrets.js`)
4. Application only starts if all validations pass

### Secret Retrieval Flow

1. `secretService.getSecret('SECRET_NAME')` called from any feature module
2. VersionTracker determines current version from `secrets.json` (e.g., V1, V2)
3. SecretService retrieves value from `process.env[SECRET_NAME]` or `process.env[SECRET_NAME_V1]`
4. Throws error if secret not found

### Rotation Warning

The system checks all tracked secrets at startup and warns if rotation is overdue (90+ days):

```javascript
const secretsNeedingRotation = secretService.checkAllSecretsRotation(90);
secretsNeedingRotation.forEach(({ name, daysSinceRotation }) => {
    console.warn(`⚠️ Secret rotation due: ${name} (${daysSinceRotation} days ago)`);
});
```

### Secret Rotation

To rotate a secret:

```javascript
const { getSecretService } = require('./secrets/secretService');
const svc = getSecretService();

// Generate new secret and get versioned key
const { versionedKey, newSecret } = svc.rotateSecret('ENDUSER_JWT_SECRET');

// Update .env with the new versioned key
// ENDUSER_JWT_SECRET_V2=<newSecret>
```

## Files Created/Modified

| File | Action |
|------|--------|
| `src/secrets/secretGenerator.js` | Created - Cryptographically strong secret generation |
| `src/secrets/versionTracker.js` | Implemented - Version and rotation tracking |
| `src/secrets/secretService.js` | Implemented - Centralized secret access |
| `src/secrets/secrets.json` | Created - Secret metadata storage |
| `config/secrets.js` | Modified - Uses SecretGenerator, supports versioned keys |
| `src/index.js` | Modified - Initializes SecretService at startup |
| `.env` | Modified - Added versioned secret keys |
| `.gitignore` | Modified - Added secrets.json to ignore list |
| `docs/SECRET_ROTATION_PROCEDURE.md` | Created - Team rotation guide |