# Secret Management Architecture

This document describes how to implement a robust secret management system into the codebase following the provided checklist. The implementation will transform the application from using hardcoded or weakly managed secrets to a secure, versioned, and rotatable secret system.

## Architecture Overview

The secret management system follows a layered approach where secret handling is centralized and isolated:

```
┌─────────────────────────────────┐
│          Application            │  Uses secrets via SecretService
├─────────────────────────────────┤
│        Secret Management        │  SecretService, VersionTracker
├─────────────────────────────────┤
│          Secret Storage         │  .env file, Secret Vault (future)
├─────────────────────────────────┤
│        Secret Generation        │  Crypto-based random bytes
└─────────────────────────────────┘
```

### Current State

- Secrets may be hardcoded or stored in `.env` without versioning
- No automated secret generation or validation
- No rotation tracking or reminders
- Secrets validated only when used (potential runtime failures)

### Target State

- Strong secrets generated using Node.js crypto module
- `.env` file updated with minimum 32-character secrets
- Secret version tracking implemented
- Secret validation performed on application startup
- Automated rotation reminders (every 90 days)
- Documented rotation procedure for team members

## Layer-by-Layer Impact Analysis

### Application Layer

**Changes Required:**
- Replace direct process.env access with SecretService.getSecret()
- Add startup validation check
- Handle versioned secret retrieval

### Secret Management Layer (`src/secrets/`)

**New Files:**
- `secretService.js`: Centralized secret access with validation and versioning
- `versionTracker.js`: Tracks secret versions and rotation dates
- `secretGenerator.js`: Generates cryptographically strong secrets

**Responsibilities:**
1. Generate secrets using `crypto.randomBytes(32).toString('hex')`
2. Validate secret length and complexity on access
3. Track versions and rotation timestamps
4. Provide interface for secret retrieval with version awareness
5. Validate all required secrets on application startup

### Secret Storage Layer (`.env`)

**Changes Required:**
- Update existing secrets to minimum 32 characters
- Add version suffixes to secret keys (e.g., `DB_PASSWORD_V1`)
- Maintain mapping of current versions in version tracker file

### Secret Generation Layer

**Implementation:**
- Use Node.js built-in `crypto` module
- Function: `generateSecret(length = 32)` returning hex string
- Ensure minimum 32 characters as required

## Service Interaction Flow

```
Application Startup
       ↓
[index.js] → SecretService.initialize()
       ↓
[secretService.js] 
       │  ├─ Load .env file
       │  ├─ Validate all required secrets exist and are ≥32 chars
       │  ├─ Check version tracker for rotation status
       │  └─ Throw error if validation fails (prevents startup with invalid secrets)
       ↓
Application Ready
       ↓
[Feature Module] → SecretService.getSecret('API_KEY')
       ↓
[secretService.js]
       │  ├─ Check version tracker for current version
       │  ├─ Construct versioned key (e.g., API_KEY_V2)
       │  ├─ Retrieve from process.env
       │  └─ Return secret value
       ↓
Feature Module Uses Secret
```

## File Manifest

### Files Created

| File | Layer | Purpose |
|------|-------|---------|
| `src/secrets/secretGenerator.js` | Secret Generation | Generate cryptographically strong secrets |
| `src/secrets/versionTracker.js` | Secret Management | Track secret versions and rotation dates |
| `src/secrets/secretService.js` | Secret Management | Centralized secret access with validation |
| `src/secrets/secrets.json` | Secret Storage | Version tracking and rotation metadata |
| `docs/SECRET_ROTATION_PROCEDURE.md` | Documentation | Team procedure for secret rotation |

### Files Modified

| File | Layer | Change Type |
|------|-------|-------------|
| `.env` | Secret Storage | Update secrets to ≥32 chars, add versioning |
| `src/index.js` or `src/app.js` | Application | Add SecretService initialization |
| `package.json` | Project | Add any required dependencies (none for core crypto) |

### Files Unchanged

| File | Reason |
|------|--------|
| Other application logic | Secret access abstracted behind service |
| Configuration files | No direct secret handling |
| Test files | Will be updated separately for mock secrets |

## Dependency Graph

```
secretService.js
    ├─ secretGenerator.js
    ├─ versionTracker.js
    └─ dotenv (external)

versionTracker.js
    └─ fs (built-in) for secrets.json

secretGenerator.js
    └─ crypto (built-in)

index.js
    └─ secretService.js
```

## Testing Strategy

### Unit Tests

| Test File | Tests |
|-----------|-------|
| `test/secrets/secretGenerator.test.js` | Verify secret length, randomness, format |
| `test/secrets/versionTracker.test.js` | Version tracking, rotation date calculations |
| `test/secrets/secretService.test.js` | Secret retrieval, validation, error handling |

### Integration Tests

| Test File | Scenario |
|-----------|----------|
| `test/secrets/startup.test.js` | Application fails to start with invalid secrets |
| `test/secrets/rotation.test.js` | Secret version increments after rotation |

### Notes
- Mock `process.env` in tests
- Use temporary `.env.test` file for integration tests
- Validate that secrets are never logged in tests

## Production Considerations

### Secret Strength

| Concern | Mitigation |
|---------|------------|
| Predictable secrets | Use crypto.randomBytes (CSPRNG) |
| Short secrets | Enforce minimum 32 characters |
| Secret leakage | Never log secrets, use secure storage |

### Secret Rotation

| Concern | Mitigation |
|---------|------------|
| Forgotten rotation | Automated 90-day reminders (cron job/CI) |
| Downtime during rotation | Versioned secrets allow gradual rollout |
| Tracking complexity | Centralized version tracker with timestamps |

### Storage Security

| Concern | Mitigation |
|---------|------------|
| .env exposure | Add to .gitignore, use vault in production |
| Secret history | Version tracker doesn't store actual secrets |
| Access control | File permissions, secret scanning in CI |

## Rollout Sequence

1. **Generate Initial Secrets**
   - Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` for each required secret
   - Update `.env` with new secrets (minimum 32 chars each)

2. **Implement Secret Management Layer**
   - Create `secretGenerator.js`, `versionTracker.js`, `secretService.js`
   - Create initial `secrets.json` for version tracking

3. **Update Application Entry Point**
   - Add `SecretService.initialize()` call at startup
   - Add error handling for initialization failures

4. **Migrate Secret Usage**
   - Replace `process.env.SECRET_NAME` with `SecretService.getSecret('SECRET_NAME')`
   - Add version suffixes to `.env` keys as needed (V1, V2, etc.)

5. **Add Rotation Reminder**
   - Implement cron job or CI check that warns when secrets approach 90 days
   - Update `docs/SECRET_ROTATION_PROCEDURE.md` with team instructions

6. **Validate and Test**
   - Run application to confirm startup validation works
   - Test secret retrieval and version tracking
   - Verify rotation reminder triggers appropriately

7. **Team Documentation**
   - Distribute `SECRET_ROTATION_PROCEDURE.md` to development team
   - Conduct briefing on new secret management process

This architecture ensures secrets are strongly generated, properly versioned, validated at startup, and rotated on a regular schedule with clear team procedures.