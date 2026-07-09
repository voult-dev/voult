 # Voult.dev — Architecture Deep Dive

> A complete guide to understanding data flow, authentication, sessions, tokens, and how to consume the Voult API from an external codebase.

---

## Table of Contents

1. [High-Level Architecture Overview](#1-high-level-architecture-overview)
2. [Directory Structure & Responsibilities](#2-directory-structure--responsibilities)
3. [The Two User Worlds: Developer vs End User](#3-the-two-user-worlds-developer-vs-end-user)
4. [Request Lifecycle — How a Request Travels Through the App](#4-request-lifecycle--how-a-request-travels-through-the-app)
5. [Registration Flow (End User)](#5-registration-flow-end-user)
6. [Login Flow (End User)](#6-login-flow-end-user)
7. [Session Architecture (Developer Accounts)](#7-session-architecture-developer-accounts)
8. [Token Architecture (End Users / API)](#8-token-architecture-end-users--api)
9. [Middleware Chain — The Gatekeeper Layer](#9-middleware-chain--the-gatekeeper-layer)
10. [OAuth Flow Architecture](#10-oauth-flow-architecture)
11. [Magic Link Flow](#11-magic-link-flow)
12. [How an External App Consumes Voult](#12-how-an-external-app-consumes-voult)
13. [Database Models & Their Relationships](#13-database-models--their-relationships)
14. [Error Propagation Architecture](#14-error-propagation-architecture)
15. [Key Architectural Patterns to Know](#15-key-architectural-patterns-to-know)
16. [Secret Management Architecture](#16-secret-management-architecture)

---

## 1. High-Level Architecture Overview

Voult is an **Authentication-as-a-Service** platform. Think of it like Auth0 or Clerk, but self-hosted and developer-owned. There are two distinct "planes" in the codebase:

```
┌─────────────────────────────────────────────────────────────────┐
│                        VOULT SERVER                             │
│                                                                 │
│   ┌─────────────────────────┐   ┌───────────────────────────┐  │
│   │   WEB PLANE (HTML/EJS)  │   │    API PLANE (JSON/REST)  │  │
│   │                         │   │                           │  │
│   │  Developer accounts     │   │  End user authentication  │  │
│   │  App management         │   │  consumed by external     │  │
│   │  OAuth config           │   │  apps via Client ID +     │  │
│   │  Sessions (cookies)     │   │  Client Secret headers    │  │
│   └─────────────────────────┘   └───────────────────────────┘  │
│                                                                 │
│   Shared: MongoDB, JWT utilities, Email service, Models        │
└─────────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │                                    │
   Developer                           External App
   (browser)                           (your Next.js / Express app)
```

**The core mental model:**

- **Developers** log in via the web UI (browser sessions, EJS pages) to create and configure "Apps."
- Each **App** gets a `clientId` and `clientSecret`.
- **External apps** use those credentials in HTTP headers to call the Voult API on behalf of their own users (End Users).
- End Users never touch Voult directly — they touch your app, which calls Voult.

---

## 2. Directory Structure & Responsibilities

```
voult/
│
├── src/index.js          ← App entry point. Boots Express, mounts all middleware,
│                           connects DB, starts server.
│
├── config/
│   ├── database.js       ← Mongoose connection setup
│   ├── mailer.js         ← Nodemailer/Brevo SMTP transporter
│   ├── passport.js       ← Passport strategies (Local, Google, GitHub)
│   └── session.js        ← express-session config object
│
├── models/
│   ├── developer.js      ← Developer (platform user) schema — uses passport-local-mongoose
│   ├── endUser.js        ← End User (your app's users) schema
│   ├── app.js            ← App schema — clientId, clientSecret, OAuth configs
│   ├── refreshToken.js   ← Hashed refresh tokens with TTL
│   ├── OAuthAccount.js   ← Linked OAuth provider accounts per end user
│   └── MagicLinkToken.js ← Magic link tokens with atomic claim support
│
├── routes/
│   ├── index.js          ← Central router — mounts all sub-routers
│   ├── web/              ← Browser routes (EJS responses)
│   │   ├── auth.js       ← /login, /register, /logout, /auth/google, /auth/github
│   │   ├── user.js       ← /dashboard, /apps, /forgot-password, /reset-password
│   │   ├── app.js        ← /app/:id (CRUD + OAuth config)
│   │   └── settings.js   ← /settings (profile, email, password, delete account)
│   └── api/              ← JSON API routes
│       ├── auth.js       ← /api/auth/register, /login, /logout
│       ├── user.js       ← /api/user/me, /verify-email, /forgot-password
│       ├── session.js    ← /api/sessions (list, revoke, refresh token)
│       ├── google.js     ← /api/auth/google/register|login
│       ├── github.js     ← /api/auth/github/register|login
│       ├── facebook.js   ← /api/auth/facebook/register|login
│       ├── linkedin.js   ← /api/auth/linkedin/register|login
│       ├── microsoft.js  ← /api/auth/microsoft/register|login
│       ├── apple.js      ← /api/auth/apple/register|login
│       ├── magicLink.js  ← /api/send-magic-link, /validate-magic-link
│       ├── oauth.js      ← /api/:provider/authorize|callback (generic OAuth)
│       └── oauthLinking.js ← /api/oauth/:provider/link, /me/oauth-accounts
│
├── controllers/
│   ├── web/              ← Handler functions for web routes
│   └── api/              ← Handler functions for API routes
│
├── middleware/
│   ├── verifyClient.js       ← Validates X-Client-Id + X-Client-Secret headers
│   ├── verifyEndUserJWT.js   ← Parses Bearer token → attaches req.endUser
│   ├── requireEndUserAuth.js ← Enforces req.endUser exists
│   ├── requireActiveEndUser.js ← Enforces req.endUser.isActive
│   ├── validateCallbackUrl.js ← Checks redirectUri against app allowlist
│   ├── rateLimiters.js       ← express-rate-limit configs
│   ├── apiErrorHandler.js    ← Catches errors on /api/* routes
│   └── middleware.js         ← isLoggedIn, redirectIfLoggedIn, storeReturnTo
│
├── utils/
│   ├── jwt.js            ← signEndUserToken, signAccessToken, signRefreshToken
│   ├── refreshToken.js   ← createRefreshToken (creates DB record)
│   ├── catchAsync.js     ← Wraps async controllers to pass errors to next()
│   ├── apiError.js       ← ApiError class + sendError helper
│   └── [provider]OAuth.js ← Per-provider token exchange + profile fetch
│
├── services/
│   ├── emailService.js   ← All outbound email functions
│   ├── emailOnLock.js    ← Account locked email
│   ├── magicLinkEmail.js ← Magic link email
│   └── oauth/
│       └── generateProviderAuthUrl.js ← Builds OAuth redirect URLs
│
├── secrets/
│   ├── secretGenerator.js    ← Generates cryptographically strong secrets
│   ├── versionTracker.js     ← Tracks secret versions and rotation dates
│   ├── secretService.js      ← Centralized secret access with validation
│   └── secrets.json          ← Secret metadata (gitignored)
│
└── validators/
    ├── api/endUserAuth.js  ← Joi schemas for API auth endpoints
    ├── web/app.js          ← Joi schemas for app creation
    └── validate.js         ← Validation middleware factory
```

---

## 3. The Two User Worlds: Developer vs End User

This is the most important conceptual distinction in the entire codebase.

### Developer (Platform User)

- Stored in: `models/developer.js` (uses `passport-local-mongoose`)
- Authenticated via: **Express sessions** (browser cookies)
- Can: create Apps, configure OAuth, rotate secrets, view the dashboard
- Session stored in: MongoDB (via `express-session`) or in-memory
- Model accessed as: `req.user` (set by Passport after `deserializeUser`)

### End User (Your App's Users)

- Stored in: `models/endUser.js`
- Authenticated via: **JWTs** (access token + refresh token)
- Scoped to: a specific App (every EndUser has an `app` field pointing to an App `_id`)
- Model accessed as: `req.endUser` (set by `verifyEndUserJWT` middleware)
- Never logs into Voult directly — your external app calls Voult on their behalf

**Why this matters architecturally:** There are two completely separate authentication systems running in the same Express app. Web routes use `req.user` + sessions. API routes use `req.endUser` + JWTs. They never mix.

---

## 4. Request Lifecycle — How a Request Travels Through the App

### Startup sequence (`src/index.js`)

```
1. Load .env → validate required env vars (ENDUSER_JWT_SECRET, BASE_URL)
2. Create Express app
3. Mount CORS middleware
4. Mount session middleware (express-session with sessionConfig)
5. Mount flash middleware (connect-flash)
6. Initialize Passport + Passport session
7. Configure EJS view engine
8. Mount static files (/public)
9. Mount method-override (for PUT/DELETE from HTML forms)
10. Mount locals middleware (res.locals.success/error/currentUser)
11. Mount body parsers (JSON + urlencoded)
12. Mount request logger
13. Mount all routes (routes/index.js)
14. Mount error handlers
15. Start listening on PORT
```

### Route mounting order (`routes/index.js`)

```
/                        ← web auth routes (login, register)
/                        ← web user routes (dashboard, apps)
/app                     ← web app management routes
/                        ← developer settings routes

[verifyEndUserJWT middleware applied to all /api/* routes]

/api/:provider/          ← generic OAuth routes
/api/auth/               ← email/username register + login + logout
/api/sessions/           ← session list, revoke, refresh
/api/user/               ← me, verify-email, forgot/reset password
/api/auth/google/        ← Google OAuth
/api/auth/github/        ← GitHub OAuth
/api/auth/facebook/      ← Facebook OAuth
/api/auth/linkedin/      ← LinkedIn OAuth
/api/auth/microsoft/     ← Microsoft OAuth
/api/                    ← OAuth linking, magic links, OAuth accounts
[apiErrorHandler]        ← catches all /api errors
/                        ← home page route (authenticated vs guest)
```

### A single API request lifecycle

```
External App → POST /api/auth/email-login
                │
                ▼
         [rateLimiter]           ← blocks if too many requests
                │
                ▼
         [validate(schema)]      ← Joi validates req.body shape
                │
                ▼
         [verifyEndUserJWT]      ← soft JWT parse (no auth required yet)
                │                  attaches req.endUser if token present
                ▼
         [verifyClient]          ← reads X-Client-Id + X-Client-Secret headers
                │                  finds App in DB, verifies bcrypt secret
                │                  attaches req.appClient
                ▼
         [authLimiter]           ← stricter per-auth rate limit
                │
                ▼
         [validateCallbackUrl]   ← checks callbackUrl body field
                │                  against app.allowedCallbackUrls
                ▼
         [catchAsync(controller)]← wraps async fn, errors go to next()
                │
                ▼
         controller logic        ← queries DB, verifies password,
                │                  generates tokens, sends response
                ▼
         [apiErrorHandler]       ← if controller threw ApiError,
                                   formats and sends JSON error response
```

---

## 5. Registration Flow (End User)

This is what happens when an external app calls `POST /api/auth/register` to create a new user.

### Data flow diagram

```
External App
    │
    │  POST /api/auth/register
    │  Headers: X-Client-Id, X-Client-Secret
    │  Body: { email, password, fullName, username? }
    │
    ▼
[validate(registerSchema)]   ← Joi: email valid, password 8-64 chars, etc.
    │
    ▼
[verifyClient middleware]
    │  App.findOne({ clientId })
    │  bcrypt.compare(clientSecret, app.clientSecretHash)
    │  req.appClient = app
    │
    ▼
[authController.register]
    │
    ├─ normalize email (lowercase, trim)
    ├─ normalize username (if provided)
    ├─ if username: check format regex + uniqueness per app
    ├─ check for existing EndUser with same email + app combo
    │    EndUser.findOne({ app: app._id, email: normalizedEmail })
    │    → 409 if exists
    ├─ validatePassword(password) ← regex: uppercase+lowercase+digit+special
    ├─ create EndUser instance (not saved yet)
    │    new EndUser({ fullName, app: app._id, email, username })
    ├─ user.setPassword(password) ← bcrypt.hash(password, 12) → stores in passwordHash
    ├─ App.findById → increment usage.totalRegistrations
    ├─ user.generateEmailVerificationToken()
    │    crypto.randomBytes(32) → rawToken
    │    sha256(rawToken) → stored in user.emailVerificationToken
    │    user.emailVerificationExpires = now + 24h
    │    await user.save() ← saves the token
    ├─ signEndUserToken(user, app) ← JWT with sub, app, email, tokenVersion
    ├─ await user.save() ← final save
    ├─ verifyEndUsers(email, app.name, verifyUrl).catch() ← fire-and-forget email
    │
    ▼
Response 201:
{
  message: "User registered successfully",
  token: "<JWT>",
  user: { id, email, username }
}
```

### What `setPassword` does

```javascript
// models/endUser.js
EndUserSchema.methods.setPassword = async function(password) {
  this.passwordHash = await bcrypt.hash(password, 12);
  // Note: passwordHash has select: false — never returned in queries by default
};
```

### Email verification token

The raw token goes in the email URL. The hashed version is stored in the DB. When the user clicks the link:

```
GET /api/user/verify-email?token=<rawToken>&appId=<appId>
    │
    ├─ sha256(rawToken) → hashedToken
    ├─ EndUser.findOne({ app: appId, isEmailVerified: false,
    │                    emailVerificationToken: hashedToken })
    ├─ user.isEmailVerified = true
    ├─ clear token fields
    └─ save → Response 200
```

---

## 6. Login Flow (End User)

### Email login: `POST /api/auth/email-login`

```
External App
    │
    │  Body: { email, password }
    │  Headers: X-Client-Id, X-Client-Secret
    │
    ▼
[validate] → [verifyClient] → [authLimiter]
    │
    ▼
[emailLogin controller]
    │
    ├─ EndUser.findOne({ app: app._id, email, deletedAt: null })
    │    .select('+passwordHash')   ← must explicitly select the hidden field
    │
    ├─ if !user → ApiError 401 INVALID_CREDENTIALS
    │
    ├─ if user.lockUntil > Date.now() → ApiError 423 ACCOUNT_LOCKED
    │
    ├─ user.verifyPassword(password) ← bcrypt.compare(password, passwordHash)
    │
    ├─ if !isValid:
    │    user.failedLoginAttempts += 1
    │    if failedLoginAttempts >= 5:
    │      user.lockUntil = now + 15min
    │      accountLockedEmail(...)   ← non-blocking
    │    throw ApiError 401
    │
    ├─ ✅ Password correct → reset failedLoginAttempts = 0, lockUntil = null
    │
    ├─ if !user.isEmailVerified → ApiError 403 EMAIL_NOT_VERIFIED
    │    (email verification is checked AFTER password to avoid timing leaks)
    │
    ├─ if !user.isActive → ApiError 403 ACCOUNT_DISABLED
    │
    ├─ user.lastLoginAt = new Date()
    │
    ├─ App.findById → appO.usage.totalLogins += 1 → save
    │
    ├─ accessToken = signAccessToken(user, app)
    │    jwt.sign({ sub: user._id, appId: app._id, tokenVersion: user.tokenVersion },
    │             JWT_SECRET, { expiresIn: '15m' })
    │
    ├─ { rawToken: refreshToken } = await createRefreshToken({ endUser, app, ip, ua })
    │    crypto.randomBytes(64) → rawToken
    │    sha256(rawToken) → tokenHash
    │    RefreshToken.create({ endUser._id, app._id, tokenHash, expiresAt: +30d, ... })
    │
    ├─ await user.save()
    │
    ▼
Response 200:
{
  message: "Login successful",
  accessToken: "<15min JWT>",
  refreshToken: "<raw 64-byte hex token>",
  user: { id, email }
}
```

### Username login: `POST /api/auth/username-login`

Identical flow, but finds user by `username` instead of `email`. The `email` verification check is conditional: `if (user.email && !user.isEmailVerified)`.

---

## 7. Session Architecture (Developer Accounts)

Sessions are only used for **developer accounts** (the people who log in to voult.dev itself to manage apps).

### Session setup (`config/session.js` + `src/index.js`)

```javascript
// session cookie is an httpOnly cookie named 'connect.sid' (default)
// The cookie stores only the session ID
// The actual session data lives server-side (in-memory by default, 
// or MongoDB store in production)

sessionConfig = {
  secret: process.env.SECRET,    // signs the session ID cookie
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,               // ⚠️ should be true in production (HTTPS only)
    httpOnly: true,              // JS can't read it
    sameSite: 'lax',
    expires: +7 days
  }
}
```

### Developer login flow (`routes/web/auth.js`)

```
POST /login
    │
    ├─ [storeReturnTo] ← saves req.session.returnTo for post-login redirect
    ├─ [webAuthLimiter] ← 5 attempts per 15min per IP
    ├─ passport.authenticate('local', { failureRedirect, failureFlash })
    │      │
    │      ▼
    │   LocalStrategy (config/passport.js)
    │      Developer.findOne({ email })
    │      developer.authenticate(password, done)
    │      ← passport-local-mongoose handles bcrypt compare
    │
    ├─ On success: passport calls serializeUser
    │      done(null, developer.id)  ← stores only the _id in session
    │
    ├─ controller.login runs:
    │      req.user.lastLoginAt = new Date()
    │      await req.user.save()
    │      res.redirect(returnUrl || '/')
    │
    ▼
Cookie set: connect.sid=<signed session ID>
```

### How req.user gets populated on subsequent requests

```
Any web route request
    │
    ├─ express-session reads connect.sid cookie
    │   → loads session data → session.passport.user = developer._id
    │
    ├─ passport.session() middleware calls deserializeUser
    │   Developer.findById(id) → done(null, developer)
    │
    └─ req.user = developer object (available in all controllers + EJS views)
```

### Session-based route protection

```javascript
// middleware.js
module.exports.isLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    // req.isAuthenticated() is added by Passport
    // returns true only if req.user exists
    req.session.returnTo = req.originalUrl;
    req.flash('error', 'You must be signed in first');
    return res.redirect('/login');
  }
  next();
};
```

**Key insight:** `req.isAuthenticated()` is a Passport method. It checks if `req.user` was populated by `deserializeUser`. Sessions and Passport are tightly coupled for the web plane.

---

## 8. Token Architecture (End Users / API)

The API plane uses **two tokens** per authenticated session — no cookies involved.

### Token types


| Token         | Format                | Lifetime   | Stored in DB? | Purpose                                 |
| ------------- | --------------------- | ---------- | ------------- | --------------------------------------- |
| Access Token  | JWT (signed)          | 15 minutes | No            | Proves identity on API requests         |
| Refresh Token | Random hex (64 bytes) | 30 days    | Yes (hashed)  | Gets new access tokens without re-login |


### Access Token internals

```javascript
// utils/jwt.js
jwt.sign(
  {
    sub: user._id,              // who this token belongs to
    appId: app._id,             // which app's users this token is for
    tokenVersion: user.tokenVersion  // invalidation mechanism
  },
  process.env.ENDUSER_JWT_SECRET,
  { expiresIn: '15m' }
)
```

`**tokenVersion` is the logout/revocation mechanism.** When a user logs out, `tokenVersion` is incremented. Any existing access tokens with the old version are silently rejected by `verifyEndUserJWT`.

### How `verifyEndUserJWT` works (soft auth)

```javascript
// middleware/verifyEndUserJWT.js
module.exports.verifyEndUserJWT = async (req, res, next) => {
  const token = getBearerToken(req);
  // reads 'Authorization: Bearer <token>' or legacy 'x-client-token: Bearer <token>'
  
  if (!token) return next();  // ← "soft" — missing token just skips, doesn't block
  
  const payload = jwt.verify(token, JWT_SECRET);  // throws if expired/invalid
  
  const endUser = await EndUser.findById(payload.sub);
  
  if (!endUser) return next();  // user deleted? skip
  
  if (endUser.tokenVersion !== payload.tokenVersion) return next();  // revoked
  
  req.tokenPayload = payload;
  req.appId = payload.appId || endUser.app;
  req.endUser = endUser;    // ← this is how downstream middleware/controllers get the user
  req.user = { id, email, username };  // ← simplified shape
  
  next();
};
```

**Important:** `verifyEndUserJWT` never throws. It's a "soft" middleware. If the token is missing or invalid, it just calls `next()` without setting `req.endUser`. The *hard* enforcement happens in `requireEndUserAuth`.

### Refresh Token flow

```
External App → POST /api/sessions/refresh
               Body: { refreshToken: "<raw 64-byte hex>" }
    │
    ▼
[controller.refresh]
    │
    ├─ tokenHash = sha256(refreshToken)
    ├─ storedToken = RefreshToken.findOne({ tokenHash }).populate('endUser')
    │
    ├─ if !storedToken → 401 INVALID_REFRESH_TOKEN
    │
    ├─ if storedToken.revokedAt → REUSE DETECTED
    │    RefreshToken.updateMany(
    │      { endUser: ..., app: ..., revokedAt: null },
    │      { revokedAt: new Date() }     ← revoke ALL sessions for this user+app
    │    )
    │    → 401 REFRESH_TOKEN_REUSE_DETECTED
    │
    ├─ if storedToken.expiresAt < now → 401 REFRESH_TOKEN_EXPIRED
    │
    ├─ TOKEN ROTATION:
    │    storedToken.revokedAt = new Date()  ← old token is revoked
    │    { rawToken: newRefreshToken } = createRefreshToken(...)  ← new token created
    │    storedToken.replacedByTokenHash = sha256(newRefreshToken)
    │    storedToken.lastUsedAt = new Date()
    │    await storedToken.save()
    │
    ├─ accessToken = signAccessToken(storedToken.endUser, storedToken.app)
    │
    ▼
Response: { accessToken: "<new 15min JWT>", refreshToken: "<new raw token>" }
```

**Key security property:** Refresh token rotation means each refresh token can only be used once. If you detect reuse, it means either the old token was stolen and used, OR the new token was lost — in both cases, all sessions are killed.

### Logout flow

```
POST /api/auth/logout
Headers: Authorization: Bearer <accessToken>
         X-Client-Id, X-Client-Secret
    │
    ▼
[verifyEndUserJWT] → sets req.endUser
[verifyClient] → sets req.appClient
[requireEndUserAuth] → enforces req.endUser exists
[requireActiveEndUser] → enforces user is active
    │
    ▼
[authController.logout]
    │
    ├─ RefreshToken.updateMany(
    │    { endUser: req.endUser._id, app: req.appClient._id, revokedAt: null },
    │    { revokedAt: new Date() }
    │  )  ← revokes ALL refresh tokens for this user+app combo
    │
    ├─ req.endUser.tokenVersion += 1
    │   ← this invalidates all existing access tokens immediately
    │   ← even tokens that haven't expired yet are now rejected by verifyEndUserJWT
    │
    └─ await req.endUser.save()
```

---

## 9. Middleware Chain — The Gatekeeper Layer

Here's the mental model for understanding which middleware is responsible for what:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE RESPONSIBILITIES                   │
├────────────────────────┬────────────────────────────────────────┤
│ verifyClient           │ "Does this request come from a valid   │
│                        │  registered App?"                      │
│                        │ Reads: X-Client-Id, X-Client-Secret    │
│                        │ Sets:  req.appClient                   │
├────────────────────────┼────────────────────────────────────────┤
│ verifyClientIdOnly     │ Same, but skips secret check           │
│                        │ Used for OAuth routes where the        │
│                        │ secret flow is handled by the provider │
├────────────────────────┼────────────────────────────────────────┤
│ verifyEndUserJWT       │ "Is there a valid JWT in the request?" │
│ (SOFT — never blocks)  │ Reads: Authorization / x-client-token  │
│                        │ Sets:  req.endUser, req.tokenPayload   │
│                        │ Applied to ALL /api/* routes globally  │
├────────────────────────┼────────────────────────────────────────┤
│ requireEndUserAuth     │ "There MUST be an authenticated user"  │
│ (HARD — blocks)        │ Checks: req.endUser exists             │
│                        │ Also checks appClient/token app match  │
│                        │ → 401 if not set                       │
├────────────────────────┼────────────────────────────────────────┤
│ requireActiveEndUser   │ "The user must not be disabled"        │
│                        │ Checks: req.endUser.isActive           │
│                        │ → 403 if disabled                      │
├────────────────────────┼────────────────────────────────────────┤
│ validateCallbackUrl    │ "Is the redirectUri in the allowlist?" │
│                        │ Reads: req.body.callbackUrl            │
│                        │ Checks: app.allowedCallbackUrls        │
├────────────────────────┼────────────────────────────────────────┤
│ isLoggedIn             │ WEB ONLY: "Is developer logged in?"    │
│                        │ Uses req.isAuthenticated() (Passport)  │
│                        │ → redirect /login if not              │
├────────────────────────┼────────────────────────────────────────┤
│ authLimiter            │ Strict: 10 req / 15min / IP            │
│ apiLimiter             │ Loose: 100 req / 15min / IP            │
│ webAuthLimiter         │ Strict: 5 req / 15min / IP (web forms) │
└────────────────────────┴────────────────────────────────────────┘
```

### Typical API route middleware stack

```javascript
// Route that requires: valid app + authenticated active end user
router.post('/some-protected-route',
  verifyClient,           // 1. App must be valid
  requireEndUserAuth,     // 2. End user must have valid JWT
  requireActiveEndUser,   // 3. End user must be active
  catchAsync(controller)  // 4. Run controller safely
);
```

### `catchAsync` pattern

Every async controller is wrapped in `catchAsync`:

```javascript
// utils/catchAsync.js
module.exports = func => {
  return (req, res, next) => {
    Promise.resolve(func(req, res, next)).catch(next);
    // any thrown error or rejected promise → next(err) → apiErrorHandler
  };
};
```

This means controllers can `throw new ApiError(...)` directly and it will be caught.

---

## 10. OAuth Flow Architecture

### How OAuth works in Voult (two models)

**Model A: Direct provider token exchange (Google, GitHub, Facebook, etc.)**

The external app handles the OAuth redirect itself and sends the resulting code/token to Voult:

```
User clicks "Login with Google" on Your App
    │
    ▼
Your App redirects to: https://accounts.google.com/o/oauth2/v2/auth?...
    │
    ▼ (user authenticates on Google)
Google redirects to: YOUR_APP/auth/callback?code=abc123
    │
    ▼
Your App sends: POST /api/auth/google/login
                Headers: X-Client-Id, (no secret needed — verifyClientIdOnly)
                Body: { idToken: "..." } or { accessToken: "..." }
    │
    ▼
Voult verifies the token with Google's public keys
Voult finds/creates EndUser
Voult returns: { accessToken, refreshToken }
```

**Model B: Voult-managed OAuth redirect (generic `/api/:provider/authorize`)**

Voult generates the OAuth URL and handles the callback:

```
Your App calls: POST /api/google/authorize
                Body: { intent: "login", redirectUri: "https://myapp.com/cb" }
    │
    ▼
Voult returns: { authUrl: "https://accounts.google.com/..." }
    │
    ▼
Your App redirects user to authUrl
    │
    ▼ (user authenticates)
Google redirects to: voult.dev/api/google/callback?code=...&state=...
    │
    ▼
Voult handles callback, processes user, returns JWT
```

### OAuth credential verification (`verifyClientIdOnly` vs `verifyClient`)

OAuth routes use `verifyClientIdOnly` — they only need the `X-Client-Id` header, not the secret. This is because the "proof" in OAuth flows is the authorization code from the provider, not a client secret in the request body.

### Per-provider controller pattern

Every OAuth controller follows the same structure:

```javascript
// Example: controllers/api/google.js - googleLogin
async (req, res) => {
  const { idToken, accessToken } = req.body;
  const app = req.appClient;  // from verifyClientIdOnly

  // 1. Verify with provider
  const payload = await getGooglePayload({ idToken, accessToken, clientId: app.googleOAuth.clientId });

  // 2. Check provider config is enabled
  if (!app.googleOAuth?.clientId) throw ApiError(400, 'GOOGLE_NOT_CONFIGURED');

  // 3. Find existing user by email
  const user = await EndUser.findOne({ app: app._id, email, deletedAt: null });
  if (!user) throw ApiError(404, 'USER_NOT_FOUND');

  // 4. Link provider ID if not already linked
  if (!user.googleId) { user.googleId = googleId; user.authProvider = 'google'; }

  // 5. Update last login
  user.lastLoginAt = new Date();
  await user.save();

  // 6. Issue tokens (same as email login)
  const accessToken = signAccessToken(user, app);
  const { rawToken: refreshToken } = await createRefreshToken({ endUser: user, app, ... });

  res.json({ accessToken, refreshToken, user: { id, email } });
}
```

---

## 11. Magic Link Flow

```
POST /api/send-magic-link
Body: { email, clientId, redirectUri }
    │
    ├─ Find App by clientId
    ├─ Check redirectUri is in app.allowedCallbackUrls
    ├─ Generate rawToken = crypto.randomBytes(32).hex
    ├─ MagicLinkToken.create({
    │    email, app: app._id,
    │    tokenHash: sha256(rawToken),
    │    expiresAt: now + 10min,
    │    redirectUri
    │  })
    ├─ Send email with link: redirectUri?token=rawToken
    │
    ▼
Email sent. User clicks link → redirected to YOUR APP's redirectUri

Your App extracts token from URL

POST /api/validate-magic-link
Body: { token: rawToken }
    │
    ├─ tokenHash = sha256(token)
    ├─ MagicLinkToken.claimValidToken(token)  ← ATOMIC findOneAndUpdate
    │    finds: { tokenHash, used: false, expiresAt: { $gt: now } }
    │    sets:  { used: true, usedAt: now }
    │    ← atomic: prevents race conditions / double-use
    │
    ├─ EndUser.findOne({ email: tokenDoc.email, app: tokenDoc.app, deletedAt: null })
    ├─ user.lastLoginAt = now; user.isEmailVerified = true; save()
    ├─ createTokens({ user, app: tokenDoc.app, ipAddress, userAgent })
    │
    ▼
Response: { accessToken, refreshToken, user: { id, email, fullName, isEmailVerified } }
```

---

## 12. How an External App Consumes Voult

This section is for building on top of Voult. Here's the complete mental model.

> **Auth-only product integration:** if another codebase uses Voult solely for authentication (HTTP API / `voult-sdk`) and nothing else, follow the feature-by-feature guide: [AUTH_ONLY_FEATURE_GUIDE.md](../integration/AUTH_ONLY_FEATURE_GUIDE.md).

### Setup: What you need from Voult

1. Go to voult.dev → create an App
2. Note down: `CLIENT_ID` and `CLIENT_SECRET`
3. Store these in your app's environment variables — **never expose them to the browser**

### Required headers for every API call

```
X-Client-Id: app_your_client_id_here
X-Client-Secret: your_client_secret_here
```

These authenticate **your app** to Voult (not your user).

### Authentication for end user actions

After login, you receive `accessToken` and `refreshToken`. Store them appropriately:

- `**accessToken` (15 min JWT):** Use as `Authorization: Bearer <token>` on protected API calls
- `**refreshToken` (30-day raw token):** Store securely; use to get new access tokens

### Token storage recommendations by context


| Context               | Access Token               | Refresh Token                     |
| --------------------- | -------------------------- | --------------------------------- |
| Server-side (Node.js) | In-memory or session store | Encrypted in database or session  |
| Browser SPA           | Memory (variable)          | HttpOnly cookie or secure storage |
| Mobile app            | Secure keychain/keystore   | Secure keychain/keystore          |
| **Never**             | localStorage               | localStorage (XSS risk)           |


### Complete integration example (Node.js / Express)

```javascript
// config.js
const VOULT_BASE = 'https://www.voult.dev';
const CLIENT_ID = process.env.VOULT_CLIENT_ID;
const CLIENT_SECRET = process.env.VOULT_CLIENT_SECRET;

const voultHeaders = {
  'Content-Type': 'application/json',
  'X-Client-Id': CLIENT_ID,
  'X-Client-Secret': CLIENT_SECRET
};

// ─── REGISTER ────────────────────────────────────────────────
async function registerUser(email, password, fullName) {
  const res = await fetch(`${VOULT_BASE}/api/auth/register`, {
    method: 'POST',
    headers: voultHeaders,
    body: JSON.stringify({ email, password, fullName })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Registration failed');
  // Returns: { token, user: { id, email } }
  // Note: user must verify email before they can log in
  return data;
}

// ─── LOGIN ───────────────────────────────────────────────────
async function loginUser(email, password) {
  const res = await fetch(`${VOULT_BASE}/api/auth/email-login`, {
    method: 'POST',
    headers: voultHeaders,
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    // data.error.code will be one of:
    // INVALID_CREDENTIALS, EMAIL_NOT_VERIFIED, ACCOUNT_DISABLED,
    // ACCOUNT_LOCKED, VALIDATION_ERROR
    throw new Error(data.error?.code);
  }
  // Returns: { accessToken, refreshToken, user: { id, email } }
  return data;
}

// ─── REFRESH TOKEN ───────────────────────────────────────────
async function refreshAccessToken(refreshToken) {
  const res = await fetch(`${VOULT_BASE}/api/sessions/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
    // NOTE: No X-Client-Id/Secret needed for refresh
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.code);
  // Returns: { accessToken, refreshToken }
  // IMPORTANT: always save the NEW refreshToken — old one is now revoked
  return data;
}

// ─── GET CURRENT USER ────────────────────────────────────────
async function getCurrentUser(accessToken) {
  const res = await fetch(`${VOULT_BASE}/api/user/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      // No X-Client-Id/Secret needed — the JWT encodes the app
    }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.code);
  return data; // { id, email, name, isEmailVerified, lastLoginAt, ... }
}

// ─── LOGOUT ──────────────────────────────────────────────────
async function logoutUser(accessToken) {
  const res = await fetch(`${VOULT_BASE}/api/auth/logout`, {
    method: 'POST',
    headers: {
      ...voultHeaders,
      'Authorization': `Bearer ${accessToken}`
    }
  });
  // This revokes ALL refresh tokens for this user + increments tokenVersion
  return res.ok;
}
```

### Token manager pattern (for long-running server processes)

```javascript
class VoultTokenManager {
  constructor(userId) {
    this.userId = userId;
    this.accessToken = null;
    this.refreshToken = null;
    this.accessTokenExpiresAt = null;
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    // JWTs encode their expiry — decode it for proactive refresh
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString()
    );
    this.accessTokenExpiresAt = payload.exp * 1000; // convert to ms
  }

  async getValidAccessToken() {
    const bufferMs = 60 * 1000; // refresh 1 minute before expiry
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - bufferMs) {
      return this.accessToken;
    }
    // Need to refresh
    const { accessToken, refreshToken } = await refreshAccessToken(this.refreshToken);
    this.setTokens(accessToken, refreshToken);
    // IMPORTANT: persist new refreshToken to your DB here
    await saveRefreshTokenToDB(this.userId, refreshToken);
    return this.accessToken;
  }
}
```

### Interpreting error codes

```javascript
// All Voult API errors follow this shape:
// { error: { code: string, message: string, status: number } }

const ERROR_HANDLING = {
  // Auth errors
  'INVALID_CREDENTIALS':          'Wrong email or password',
  'EMAIL_NOT_VERIFIED':           'User needs to verify email first',
  'ACCOUNT_DISABLED':             'Account was disabled',
  'ACCOUNT_LOCKED':               'Too many failed attempts, locked for 15min',
  
  // Token errors
  'INVALID_REFRESH_TOKEN':        'Refresh token not found — must re-login',
  'REFRESH_TOKEN_EXPIRED':        'Refresh token expired — must re-login',
  'REFRESH_TOKEN_REUSE_DETECTED': 'Security breach — all sessions killed',
  
  // Validation errors
  'VALIDATION_ERROR':             'Request body failed Joi validation',
  'WEAK_PASSWORD':                'Password doesn\'t meet complexity rules',
  'USER_EXISTS':                  'Email already registered for this app',
  'USERNAME_TAKEN':               'Username already taken for this app',
  
  // Client errors
  'INVALID_CLIENT':               'X-Client-Id is wrong or app is inactive',
  'INVALID_CLIENT_SECRET':        'X-Client-Secret is wrong',
  'CLIENT_ID_REQUIRED':           'Missing X-Client-Id header',
  'UNAUTHORIZED':                 'Missing or invalid Bearer token',
  'TOKEN_APP_MISMATCH':           'Token was issued for a different app'
};
```

### Accessing protected routes on your own backend

When your backend needs to make authenticated calls to Voult on behalf of your user:

```javascript
// Express middleware to attach voult user to req
async function requireVoultAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const accessToken = authHeader.slice(7);
  
  try {
    const user = await getCurrentUser(accessToken);
    req.voultUser = user;
    next();
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') {
      // Try to refresh using stored refresh token
      const storedRefreshToken = await getRefreshTokenFromDB(/* some identifier */);
      try {
        const { accessToken: newToken, refreshToken: newRefresh } = 
          await refreshAccessToken(storedRefreshToken);
        await saveRefreshTokenToDB(/* id */, newRefresh);
        // retry...
      } catch {
        return res.status(401).json({ error: 'Session expired' });
      }
    }
    return res.status(401).json({ error: 'Authentication failed' });
  }
}
```

---

## 13. Database Models & Their Relationships

```
Developer (1)
    │
    └──< App (many)           Developer owns many Apps
           │
           ├──< EndUser (many)         App has many end users
           │      │
           │      └──< RefreshToken (many)   User has many active sessions
           │      │
           │      └──< OAuthAccount (many)   User can link multiple OAuth providers
           │      │
           │      └──< MagicLinkToken (many) Pending magic links
           │
           └── OAuth Configs              Embedded in App document
                  googleOAuth: { enabled, clientId, clientSecret, redirectUri }
                  githubOAuth: { ... }
                  facebookOAuth: { ... }
                  linkedinOAuth: { ... }
                  appleOAuth: { ... }
                  microsoftOAuth: { ... }
```

### Key model design decisions

**EndUser uniqueness constraints:**

```javascript
// email unique per app (not globally — same email can exist in different apps)
EndUserSchema.index({ app: 1, email: 1 }, { unique: true, sparse: true });
// sparse: allows multiple null (users without email — e.g. Facebook users)

// username unique per app
EndUserSchema.index({ app: 1, username: 1 }, { unique: true, sparse: true });
```

**RefreshToken TTL (automatic cleanup):**

```javascript
// MongoDB will auto-delete documents when expiresAt passes
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

**MagicLinkToken atomic claiming:**

```javascript
// findOneAndUpdate is atomic at the MongoDB level
// prevents race conditions where two simultaneous requests use the same token
MagicLinkToken.findOneAndUpdate(
  { tokenHash, used: false, expiresAt: { $gt: now } },
  { $set: { used: true, usedAt: now } },
  { new: true }
)
```

`**passwordHash` is hidden by default:**

```javascript
passwordHash: { type: String, select: false }
// Must explicitly opt in: EndUser.findOne({...}).select('+passwordHash')
// This prevents accidentally exposing password hashes in responses
```

---

## 14. Error Propagation Architecture

### ApiError class

```javascript
// utils/apiError.js
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;  // HTTP status code
    this.code = code;      // machine-readable error code
  }
}
```

### Error flow for API routes

```
Controller throws: throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')
    │
    ▼
catchAsync catches it → next(err)
    │
    ▼
apiErrorHandler (middleware/apiErrorHandler.js)
    │  only fires for /api/* routes
    │  calls sendError(res, err)
    │
    ▼
sendError formats: { error: { code, message, status } }
    │
    ▼
Response: HTTP 401 { error: { code: "INVALID_CREDENTIALS", message: "...", status: 401 } }
```

### Error flow for web routes

```
Controller throws or calls next(err)
    │
    ▼
Global error handler in src/index.js
    │  const status = err.statusCode || 500
    │
    ├─ if 404 → render 'error/404'
    └─ else   → render 'error/500'
```

### Validation errors

```javascript
// validators/validate.js
module.exports.validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map(d => d.message).join(', ');
    if (req.originalUrl.startsWith('/api')) {
      return next(new ApiError(400, 'VALIDATION_ERROR', message));
    }
    req.flash('error', message);
    return res.redirect('back');  // web routes flash and redirect
  }
  next();
};
```

---

## 15. Key Architectural Patterns to Know

### 1. App-scoped everything

Every EndUser is scoped to an App via `app: ObjectId`. Queries always include the app ID:

```javascript
EndUser.findOne({ app: req.appClient._id, email: normalizedEmail })
// Never just: EndUser.findOne({ email })
```

This means the same email can exist in two different apps and they don't conflict.

### 7. Secret Management Architecture

All secrets are managed through a centralized `SecretService` with validation and rotation support:

```javascript
// src/secrets/secretService.js
const secretService = getSecretService();

// Initialize at startup
secretService.initialize(['ENDUSER_JWT_SECRET', 'SESSION_SECRET']);

// Get secret with automatic version resolution
const jwtSecret = secretService.getSecret('ENDUSER_JWT_SECRET');

// Check rotation status
const overdueSecrets = secretService.checkAllSecretsRotation(90);
```

**Components:**
- `secretGenerator.js` - Generates cryptographically strong secrets using `crypto.randomBytes(32)`
- `versionTracker.js` - Tracks secret versions and rotation dates in `secrets.json`
- `secretService.js` - Singleton pattern for centralized access

**Security properties:**
- Secrets validated at startup (minimum 32 characters)
- Supports versioned keys (e.g., `ENDUSER_JWT_SECRET_V1`, `ENDUSER_JWT_SECRET_V2`)
- Rotation warnings logged at startup (90-day threshold)
- Production mode works without `secrets.json` file (reads from env vars)
- All secrets gitignored (`src/secrets/secrets.json`)

---

### 2. Token hashing for storage

Raw tokens are never stored in the database. Only their SHA-256 hashes are:

```javascript
// Pattern used for: refresh tokens, email verification, password reset, magic links
const rawToken = crypto.randomBytes(32).toString('hex');
const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
// rawToken goes in the email/response
// hashedToken is stored in DB
```

### 3. Soft-delete pattern

Apps and EndUsers are never hard-deleted immediately. Instead:

```javascript
// Soft delete
app.isActive = false;
app.deletedAt = new Date();
await app.save();

// Queries exclude soft-deleted
App.findOne({ clientId, deletedAt: { $exists: false } })
EndUser.findOne({ email, deletedAt: null })
```

### 4. Fire-and-forget emails

Emails are sent asynchronously and don't block the response:

```javascript
verifyEndUsers(user.email, app.name, verifyUrl)
  .catch(err => {
    console.error('Failed to send verification email:', err.message);
    // Registration still succeeds even if email fails
  });
```

### 5. `select: false` for secrets

Sensitive fields use `select: false` and must be explicitly opted into:

```javascript
// In schema:
clientSecretHash: { type: String, select: false }
passwordHash: { type: String, select: false }

// To access them:
App.findOne({ clientId }).select('+clientSecretHash')
EndUser.findOne({ email }).select('+passwordHash')
```

### 6. Environment-based behaviour

The codebase checks `process.env.NODE_ENV` for critical security decisions. A summary of what changes in production:


| Setting                 | Development        | Production       |
| ----------------------- | ------------------ | ---------------- |
| Session cookie `secure` | `false`            | Should be `true` |
| JWT expiry              | `7d` (some places) | `15m`            |
| TLS for SMTP            | Optional           | Required         |
| SECRET validation       | Warning            | Hard throw       |
| Secret management       | Optional           | Required         |
| Security headers        | Enabled            | Enabled          |


### 7. The `req` object as a data bus

As a request travels through middleware, data accumulates on `req`:

```
After verifyClient:      req.appClient = <App document>
After verifyEndUserJWT:  req.endUser = <EndUser document>
                         req.tokenPayload = <JWT payload>
                         req.appId = <app._id string>
                         req.user = { id, email, username }
After Passport session:  req.user = <Developer document> (web routes only)
```

Controllers simply consume from `req` — they don't need to re-query for things middleware already found.

---

## Quick Reference: Which Headers to Send When

```
┌────────────────────────────────────┬──────────────────────────────────────────┐
│ Action                             │ Headers Required                         │
├────────────────────────────────────┼──────────────────────────────────────────┤
│ Register end user                  │ X-Client-Id + X-Client-Secret            │
│ Login end user                     │ X-Client-Id + X-Client-Secret            │
│ Logout end user                    │ X-Client-Id + X-Client-Secret            │
│                                    │ + Authorization: Bearer <accessToken>    │
├────────────────────────────────────┼──────────────────────────────────────────┤
│ Get current user (/me)             │ Authorization: Bearer <accessToken>      │
│ Update profile                     │ Authorization: Bearer <accessToken>      │
│ Disable account                    │ Authorization: Bearer <accessToken>      │
├────────────────────────────────────┼──────────────────────────────────────────┤
│ Refresh access token               │ (none — just Body: { refreshToken })     │
│ List sessions                      │ Authorization: Bearer <accessToken>      │
│ Revoke session                     │ Authorization: Bearer <accessToken>      │
├────────────────────────────────────┼──────────────────────────────────────────┤
│ OAuth login (Google/GitHub/etc.)   │ X-Client-Id only (no secret)             │
│                                    │ + Body: { idToken or accessToken }       │
├────────────────────────────────────┼──────────────────────────────────────────┤
│ Send magic link                    │ (none — just Body: { email, clientId,    │
│                                    │  redirectUri })                          │
│ Validate magic link token          │ (none — just Body: { token })            │
├────────────────────────────────────┼──────────────────────────────────────────┤
│ Forgot password                    │ X-Client-Id + X-Client-Secret            │
│ Reset password                     │ X-Client-Id + X-Client-Secret            │
│ Verify email (GET)                 │ (none — token is in query string)        │
└────────────────────────────────────┴──────────────────────────────────────────┘
```

