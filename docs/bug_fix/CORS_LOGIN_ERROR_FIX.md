# CORS and CSRF Login Error - Problem Analysis and Fix Guide

## Problem 1: CORS Blocking Login

When CORS is enabled, the `/login` endpoint returns a "Not allowed by CORS" error, preventing users from logging in.

**Error Message:**
```
[WEB ERROR HANDLER] Error on /login :
[WEB ERROR HANDLER] Message: Not allowed by CORS
[WEB ERROR HANDLER] Stack: Error: Not allowed by CORS
    at origin (/Users/.../src/index.js:85:16)
```

**Root Cause:**
The CORS middleware is applied **globally** to ALL routes in `src/index.js` (line 99), including web form-based routes like `/login`. CORS should only apply to API endpoints.

## Problem 2: CSRF Token Invalid on App Creation

When submitting the "Create App" form, the POST to `/app` returns a 403 error with "invalid csrf token".

**Error Message:**
```
[WEB ERROR HANDLER] Error on /app :
[WEB ERROR HANDLER] Message: invalid csrf token
[WEB ERROR HANDLER] Stack: ForbiddenError: invalid csrf token
    at csrf (/Users/.../node_modules/csurf/index.js:112:19)
[WEB ERROR HANDLER] Error code: EBADCSRFTOKEN
```

**Root Cause:**
The CSRF token middleware in `src/index.js` has a buggy session check that causes `res.locals.csrfToken` to be empty:

**In `src/index.js` lines 136-140:**
```javascript
if (!req.session || !req.session.id) {  // BUG: req.session.id is unreliable
  res.locals.csrfToken = '';
  return next();
}
```

With express-session:
- `req.session` is always an object (even for new sessions)
- `req.session.id` may be undefined even when a session exists
- `req.sessionID` (capital ID) is the correct session ID getter

This causes the CSRF token field in forms to be empty, leading to invalid token errors on submission.

## Solution

The following fixes have been applied to the codebase:

### Fix 1: CORS Middleware Scope (src/index.js)

Changed from global to API-only scope:
```javascript
// Before
app.use(cors(corsOptions));

// After
app.use('/api', cors(corsOptions));
```

### Fix 2: CSRF Token Middleware (src/index.js)

Simplified to always generate tokens without session checks:
```javascript
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.locals.csrfToken = '';
    return next();
  }
  try {
    res.locals.csrfToken = req.csrfToken();
  } catch {
    res.locals.csrfToken = '';
  }
  next();
});
```

### Fix 3: Environment Variables (.env)

- Removed trailing slash from `BASE_URL` (already correct)
- Fixed `CORS_ORIGIN` to remove leading space

## Summary of Changes

| File | Change |
|------|--------|
| `src/index.js` | Move `app.use(cors(corsOptions))` to `app.use('/api', cors(corsOptions))` |
| `.env` | Remove trailing slash from `BASE_URL` |
| `src/index.js` | Use `CORS_ORIGIN` env variable for allowed origins list |
| `public/js/csrf.js` | Fix `/auth/csrf-token` to `/csrf-token` |
| `src/index.js` | Fix CSRF middleware session check (`!req.session.id` → remove check) |
| `src/index.js` | Simplify CSRF token generation to always try `req.csrfToken()` |

## Why This Works

- Web routes (`/login`, `/register`) serve HTML forms and redirect responses - they work via standard browser navigation and don't need CORS
- API routes (`/api/*`) are called via JavaScript `fetch()` from external applications and need CORS headers
- Separating CORS to API routes eliminates the conflict while maintaining security for cross-origin API access
- The `if (!origin) return callback(null, true);` pattern allows same-origin requests that may not include an Origin header
- Removing the `!req.session.id` check ensures CSRF tokens are generated for all authenticated sessions
- The simplified CSRF middleware always attempts to generate a token, with empty string fallback for safety