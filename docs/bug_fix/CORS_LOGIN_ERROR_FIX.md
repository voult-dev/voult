# CORS Login Error - Problem Analysis and Fix Guide

## Problem

When CORS is enabled, the `/login` endpoint returns a "Not allowed by CORS" error, preventing users from logging in.

**Error Message:**
```
[WEB ERROR HANDLER] Error on /login :
[WEB ERROR HANDLER] Message: Not allowed by CORS
[WEB ERROR HANDLER] Stack: Error: Not allowed by CORS
    at origin (/Users/.../src/index.js:85:16)
```

## Root Cause

The CORS middleware is applied **globally** to ALL routes in `src/index.js` (line 99), including web form-based routes like `/login`. This creates a conflict for several reasons:

### 1. CORS Applied to Wrong Routes (Primary Issue)

**CORS is for cross-origin API requests** - It should only apply to API endpoints that are called from external origins. Traditional HTML form POSTs to `/login` don't need CORS since they submit from the same origin. The `/login` route (`routes/web/auth.js`) handles traditional form-based authentication for the voult.dev developer dashboard.

### 2. Origin Header Mismatch (Secondary Issue)

When browsers submit forms, they send an `Origin` header. If the page is served from `http://localhost:3000/`, the Origin header will be `http://localhost:3000/` (with trailing slash). However, the CORS allowed origins list has `http://localhost:3000` (without trailing slash), causing a mismatch.

**Evidence from `.env`:**
```env
BASE_URL=http://localhost:3000/  # Has trailing slash
CORS_ORIGIN=https://staging.voult.dev
```

The browser sends `Origin: http://localhost:3000/` which doesn't match the hardcoded `http://localhost:3000` in the allowed origins, triggering the CORS error.

### 3. CSRF Endpoint Path Mismatch (Tertiary Issue)

The `public/js/csrf.js` file fetches `/auth/csrf-token` but the actual route in `routes/web/auth.js` is `/csrf-token` (mounted at root, so accessible as `/csrf-token`, not `/auth/csrf-token`).

## Code Flow Analysis

**Current incorrect setup (`src/index.js`):**
```javascript
// Line 68-97: CORS configuration applied globally
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://www.voult.dev',
      'https://voult.dev',
      'https://voult.onrender.com',
      'http://localhost:3000',    // No trailing slash
      'http://127.0.0.1:3000'
    ];
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));  // Line 85 - error thrown
    }
  },
  // ...
};
app.use(cors(corsOptions));  // Line 99 - Applied to ALL routes including /login
```

## Solution

CORS should only be applied to API routes, not web routes. Here are the steps to fix:

### Step 1: Move CORS Middleware After Session Middleware

In `src/index.js`, move the CORS setup to only apply to `/api` routes:

```javascript
// Remove or comment out the global CORS application (line 99)
// app.use(cors(corsOptions));

// Add CORS only for API routes AFTER session is configured
const { verifyEndUserJWT } = require('../middleware/verifyEndUserJWT');

// ... keep session, flash, passport setup ...

// Apply CORS only to API routes (around line 180, before mounting routes)
app.use('/api', cors(corsOptions));
```

### Step 2: Fix BASE_URL Trailing Slash Issue

In `.env`, remove the trailing slash from `BASE_URL`:

```env
# Before (incorrect)
BASE_URL=http://localhost:3000/

# After (correct)
BASE_URL=http://localhost:3000
```

### Step 3: Make CORS Origin Configuration Flexible

Update `src/index.js` to use the `CORS_ORIGIN` environment variable:

```javascript
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, same-origin requests)
    if (!origin) return callback(null, true);
    
    const corsOrigin = process.env.CORS_ORIGIN;
    const allowedOrigins = corsOrigin 
      ? corsOrigin.split(',').map(o => o.trim()).filter(Boolean)
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'x-client-secret',
    'X-Client-Id',
    'x-client-token',
    'Authorization'
  ]
};
```

### Step 4: Ensure CORS Headers for Preflight Requests

The updated setup automatically handles OPTIONS preflight for API routes. No additional configuration needed.

### Step 5: Verify Environment Variables

Ensure `.env` has proper CORS configuration:

```env
CORS_ORIGIN=http://localhost:3000
BASE_URL=http://localhost:3000
```

### Step 6: Fix CSRF Endpoint Path (Secondary Fix)

The `public/js/csrf.js` fetches `/auth/csrf-token` but the route is at `/csrf-token`. Fix the fetch path:

**In `public/js/csrf.js` line 26:**
```javascript
// Before
const response = await fetch('/auth/csrf-token', {

// After
const response = await fetch('/csrf-token', {
```

Or add an alias route in `routes/web/auth.js`:
```javascript
router.get('/auth/csrf-token', (req, res) => {
  res.json({ token: req.csrfToken() });
});
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/index.js` | Move `app.use(cors(corsOptions))` to `app.use('/api', cors(corsOptions))` |
| `.env` | Remove trailing slash from `BASE_URL` |
| `src/index.js` | Use `CORS_ORIGIN` env variable for allowed origins list |
| `public/js/csrf.js` | Fix `/auth/csrf-token` to `/csrf-token` |

## Why This Works

- Web routes (`/login`, `/register`) serve HTML forms and redirect responses - they work via standard browser navigation and don't need CORS
- API routes (`/api/*`) are called via JavaScript `fetch()` from external applications and need CORS headers
- Separating CORS to API routes eliminates the conflict while maintaining security for cross-origin API access
- The `if (!origin) return callback(null, true);` pattern allows same-origin requests that may not include an Origin header