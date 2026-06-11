# 500 Error Investigation Report

## Summary

All forms in this codebase return a 500 Internal Server Error. After a thorough investigation, I identified **one critical bug** causing this issue.

---

## Critical Issue: Missing `signEndUserToken` Function

### Location
**`utils/jwt.js`** (lines 1-53) and **`controllers/api/auth.js`** (line 2)

### Problem

The `controllers/api/auth.js` file imports `signEndUserToken` that does not exist:

```javascript
// controllers/api/auth.js:2
const { signEndUserToken, signAccessToken, createRefreshToken } = require('../../utils/jwt');
```

However, `utils/jwt.js` only exports:
- `signAccessToken`
- `verifyAccessToken`
- `signRefreshToken`

The `signEndUserToken` function is **never defined or exported** in `utils/jwt.js`.

Additionally, `createRefreshToken` is also imported from the wrong module - it's defined in `utils/refreshToken.js`, not `utils/jwt.js`.

### Impact

When any API endpoint attempts to register or login an end user:
- `/api/auth/register` (line 112)
- `/api/auth/username-register` (line 235)
- `/api/auth/email-login` (line 341)
- `/api/auth/username-login` (line 440)

The code calls:

```javascript
const token = signEndUserToken(user, app);
```

This throws:

```
ReferenceError: signEndUserToken is not defined
```

Which propagates as an unhandled exception, resulting in the generic 500 error response.

### Why This Affects ALL Forms

When the auth controller throws this `ReferenceError`, Express's global error handler catches it and renders the 500 error page. Even web forms that don't directly use the API auth controller may fail because:

1. The error occurs during middleware processing
2. The global error handler in `src/index.js` (line 197-234) renders `views/error/500.ejs` for all unhandled errors
3. Session/CSRF state may be corrupted after repeated failures

---

## How to Fix

### Step 1: Add Missing Function to `utils/jwt.js`

Add the following function to `utils/jwt.js` (after the existing code):

```javascript
// Add this function to utils/jwt.js

/**
 * Sign a token for end user authentication
 */
const signEndUserToken = (user, app) => {
  return jwt.sign(
    {
      sub: user._id,
      appId: app._id,
      email: user.email,
      username: user.username,
      tokenVersion: user.tokenVersion,
    },
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: 'HS256',
    }
  );
};

// Update the exports at the bottom:
module.exports = {
  signAccessToken,
  signEndUserToken,  // ADD THIS
  verifyAccessToken,
  signRefreshToken,
  createRefreshToken: require('./refreshToken').createRefreshToken,  // Re-export from correct module
};
```

### Step 2: Verify Secret Configuration

Ensure your `.env` file has all required secrets with at least 32 characters:

```env
ENDUSER_JWT_SECRET=your_very_strong_secret_key_at_least_32_chars_long
SESSION_SECRET=your_session_secret_at_least_32_chars_long
REFRESH_TOKEN_SECRET=your_refresh_token_secret_at_least_32_chars_long
CRYPTO_KEY=your_crypto_key_at_least_32_chars_long
```

### Step 3: Verify MongoDB Connection

Check that the MongoDB connection string in `.env` is valid:
- The connection uses `process.env.DB_URL` in `config/database.js`
- Ensure the cluster is accessible and credentials are correct

---

## Verification Steps

After making the fix:

1. Restart the server: `npm run dev` or `npm start`
2. Check for startup errors in console
3. Test login form at `/login` with valid credentials
4. Test register form at `/register` with valid data
5. Check server logs for specific error messages if 500 persists

---

## Other Observations (Not Directly Causing 500 Errors)

### 1. CSRF Token Endpoint Path Mismatch
- **File:** `public/js/csrf.js` (line 26) vs `routes/web/auth.js` (line 52-54)
- **Issue:** JavaScript fetches from `/auth/csrf-token` but route is `/csrf-token`
- **Impact:** CSRF auto-fetch fails, but forms still work with hidden inputs

### 2. Session Cookie `sameSite` Setting
- **File:** `config/session.js` (line 37)
- **Issue:** `sameSite: 'strict'` in production may break OAuth redirects
- **Recommendation:** Use `'lax'` for OAuth compatibility

### 3. Hardcoded Email Addresses
- **File:** `services/emailService.js`
- **Impact:** Not a 500 error, but should be configured via environment variables