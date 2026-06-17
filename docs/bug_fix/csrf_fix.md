# CSRF Token Error on Signup

## Error Description

When calling the Voult API signup endpoint (`POST /api/auth/register`) through the `voult-sdk`, the request fails with:

```
ForbiddenError: invalid csrf token
```

This occurs because the Voult API applies CSRF protection (`csurf` middleware) to **all** routes, including API endpoints intended for programmatic clients.

## Root Cause

In `voult/src/index.js` (line 127), CSRF protection is applied globally:

```js
app.use(csrfProtection);
```

The `csrfProtection` middleware (defined in `voult/middleware/csrfProtection.js`) uses `csurf` with session-based tokens (`cookie: false`). This works for browser-based form submissions where:

1. The browser holds a session cookie
2. A CSRF token is fetched via `GET /csrf-token`
3. The token is sent back in the `X-CSRF-Token` header on POST requests

However, the `voult-sdk` is designed for **server-to-server** API calls. It authenticates using `X-Client-Id` and `X-Client-Secret` headers and does **not** maintain a session or cookies with the Voult API. When it makes a POST request to `/api/auth/register`, the `csurf` middleware rejects it because no valid CSRF token is present.

## Why This Is a Voult API Issue

The `voult-sdk` (`voult-sdk/src/client.js`) correctly sends authentication headers but has no mechanism to fetch or send CSRF tokens. This is by design — API clients using client credentials should not need CSRF protection, which is a browser-specific defense against cross-site request forgery.

## How to Fix

The fix should be applied in the **Voult API codebase** (`voult/`), not in the playground or SDK.

### Option 1: Exempt Auth API Endpoints from CSRF (Recommended)

In `voult/routes/api/auth.js`, remove `csrfProtection` from auth endpoints. Authenticated API clients using `X-Client-Id`/`X-Client-Secret` do not need CSRF protection:

```js
// Before (csrfProtection is applied)
router.post('/register', csrfProtection, validate(schemas.registerSchema), verifyClient, validateCallbackUrl, authLimiter, catchAsync(authController.register));

// After (csrfProtection removed for API auth routes)
router.post('/register', validate(schemas.registerSchema), verifyClient, validateCallbackUrl, authLimiter, catchAsync(authController.register));
```

Apply the same change to these endpoints in `voult/routes/api/auth.js`:
- `/register`
- `/username-register`
- `/email-login`
- `/username-login`
- `/logout`

### Option 2: Create a CSRF-less API Sub-router

If certain API endpoints still need CSRF protection, create a separate sub-router for public auth endpoints that bypasses CSRF, and only apply `csrfProtection` to stateful API routes that require an existing user session.

### Option 3: SDK-side Workaround (Not Recommended)

Modify the SDK to:
1. First fetch `GET /csrf-token` to obtain a token
2. Include it in all subsequent POST requests

This is not recommended because:
- It requires session cookie management in the SDK
- It adds unnecessary complexity for a server-to-server API
- CSRF is irrelevant when there are no browser sessions involved

## Recommended Fix Summary

Remove `csrfProtection` middleware from API auth routes in `voult/routes/api/auth.js`. These endpoints are secured by `verifyClient` (validates `X-Client-Id`/`X-Client-Secret`) and `authLimiter` (rate limiting), which are the appropriate security controls for API clients.
