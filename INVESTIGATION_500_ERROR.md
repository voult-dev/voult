# 500 Error Investigation Report

## Summary

All forms in this codebase return a 500 Internal Server Error. After a thorough investigation, I identified **one critical bug** causing this issue.

---

## Critical Issue: Missing `signEndUserToken` Function

### Location
**`utils/jwt.js`** (lines 1-53)

### Problem
The `controllers/api/auth.js` file imports a function `signEndUserToken` that **does not exist** in `utils/jwt.js`:

```javascript
// controllers/api/auth.js:2
const { signEndUserToken, signAccessToken, createRefreshToken } = require('../../utils/jwt');
```

However, `utils/jwt.js` only exports:
- `signAccessToken`
- `verifyAccessToken`
- `signRefreshToken`

The `signEndUserToken` function is **never defined or exported** in `utils/jwt.js`.

### Impact
When any API endpoint attempts to register or login an end user (e.g., `/api/auth/register`, `/api/auth/email-login`, `/api/auth/username-login`), the code calls:

```javascript
const token = signEndUserToken(user, app);  // Line 112, 235 in controllers/api/auth.js
```

This throws a `ReferenceError: signEndUserToken is not defined` which propagates as an unhandled exception, ultimately resulting in the generic 500 error response.

### Why This Affects ALL Forms
While the missing function is in `controllers/api/auth.js` (API routes), the error handler in `src/index.js` (line 197-234) catches ALL errors and renders the 500 error page for web routes. Since the server throws this error on any use of the auth controller, and the application fails to start properly or crashes when this function is first called, all subsequent form submissions fail.

---

## How to Fix

### Step 1: Add the Missing `signEndUserToken` Function

In `utils/jwt.js`, add the following function and export it:

```javascript
const JWT_EXPIRES_IN = process.env.NODE_ENV === 'production' ? '15m' : '7d';

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

module.exports = {
  signAccessToken,
  signEndUserToken,
  verifyAccessToken,
  signRefreshToken,
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

**Note:** The `.env` file currently uses `DB_URL` but `config/database.js` expects `process.env.DB_URL`. Verify this matches.

### Step 3: Verify MongoDB Connection

Check that the MongoDB connection string in `.env` is valid:
- The connection uses `process.env.DB_URL` in `config/database.js`
- Ensure the cluster is accessible

---

## Verification Steps

After making the fix:

1. Restart the server: `npm run dev` or `npm start`
2. Check for startup errors in console
3. Test login form at `/login` with valid credentials
4. Test register form at `/register` with valid data
5. Check server logs for specific error messages if 500 persists