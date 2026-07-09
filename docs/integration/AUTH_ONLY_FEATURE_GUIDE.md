# Implementing Auth Features with Voult (Auth-Only)

This guide is for teams whose **other codebase uses Voult only for authentication** — via the HTTP API and/or [`voult-sdk`](https://github.com/voult-dev/voult-sdk) — and nothing else (no Voult UI, no developer portal embedding, no shared database).

Your app owns product UI, sessions/cookies for *your* users, business data, and authorization. Voult owns identity: passwords, tokens, MFA, passkeys, OAuth identity, magic links, lockout, and auth audit events.

> **Related deep dives** (do not re-implement these internals):
> - Architecture & consumption model → [architecture.md](../architecture/architecture.md) §12
> - MFA / TOTP → [MFA_TOTP_GUIDE.md](../security_imp/MFA_TOTP_GUIDE.md)
> - WebAuthn / passkeys → [WEBAUTHN_GUIDE.md](../security_imp/WEBAUTHN_GUIDE.md)
> - Magic link → [MAGIC_LINK_AUTHENTICATION_GUIDE.md](../features/MAGIC_LINK_AUTHENTICATION_GUIDE.md)
> - OAuth → [OAUTH_TESTING_AND_IMPLEMENTATION_GUIDE.md](../oauth/OAUTH_TESTING_AND_IMPLEMENTATION_GUIDE.md)
> - Tokens → [TOKEN_SECURITY_AND_MANAGEMENT.md](../features/TOKEN_SECURITY_AND_MANAGEMENT.md)
> - Integrator security duties → [OVERALL_SECURITY.MD](../security_imp/OVERALL_SECURITY.MD)

---

## Table of contents

1. [Mental model](#1-mental-model)
2. [Prerequisites](#2-prerequisites)
3. [SDK vs raw HTTP](#3-sdk-vs-raw-http)
4. [Recommended architecture (BFF)](#4-recommended-architecture-bff)
5. [Quick start](#5-quick-start)
6. [Feature-by-feature implementation](#6-feature-by-feature-implementation)
7. [Headers & auth layers](#7-headers--auth-layers)
8. [CSRF & server-to-server caveats](#8-csrf--server-to-server-caveats)
9. [Error handling](#9-error-handling)
10. [Security checklist for your app](#10-security-checklist-for-your-app)
11. [Endpoint map](#11-endpoint-map)
12. [What you should not build](#12-what-you-should-not-build)

---

## 1. Mental model

```
┌──────────────────────────────┐         ┌─────────────────────────────┐
│  YOUR APPLICATION            │         │  VOULT (auth only)          │
│                              │         │                             │
│  • Product UI                │  HTTPS  │  • End-user identity        │
│  • Your API / BFF            │ ──────► │  • Passwords / MFA / OAuth  │
│  • Business DB               │         │  • Access + refresh tokens  │
│  • Your session cookie       │         │  • Email verification       │
│  • Authorization (roles…)    │         │  • Auth audit events        │
└──────────────────────────────┘         └─────────────────────────────┘
```

| Actor | Who they are | How they authenticate to Voult |
|-------|--------------|--------------------------------|
| **Developer** | You, creating an App in the Voult dashboard | Browser session on voult.dev (not used by your product users) |
| **Your app (server)** | Backend / BFF holding credentials | `X-Client-Id` + `X-Client-Secret` |
| **End user** | A user of *your* product | Never talks to Voult with the client secret; gets `accessToken` / `refreshToken` after login |

End users never “log into Voult.” They log into **your** app; your backend calls Voult.

---

## 2. Prerequisites

1. Create an **App** in the Voult developer portal.
2. Copy `clientId` and `clientSecret` into **server-side** env vars only.
3. Add every auth callback URL your app will use to the app’s **allowed callback URLs** (magic link, OAuth return URLs, etc.).
4. Set:

```bash
VOULT_BASE_URL=https://www.voult.dev   # or your self-hosted / staging URL
VOULT_CLIENT_ID=app_...
VOULT_CLIENT_SECRET=...                # never ship to browser or mobile binary
```

Password rules Voult enforces (validate in your UI before submit):

- At least 8 characters
- Uppercase, lowercase, number, and special character

---

## 3. SDK vs raw HTTP

| Approach | When to use |
|----------|-------------|
| **`voult-sdk` (`VoultClient`)** | Preferred when the package is installed in your backend. Typed errors, password helper, less boilerplate. |
| **Raw `fetch` / HTTP** | Always works; use if the SDK is not published yet or you are not on Node. |

`voult-sdk` lives in a **separate repo** (`voult-dev/voult-sdk`). It is designed for **server-to-server** calls with `X-Client-Id` / `X-Client-Secret`. It does **not** replace your product UI.

```bash
# When published:
npm install voult-sdk
```

Until then, use the HTTP examples in this guide (same headers and bodies the SDK wraps).

### SDK sketch (backend)

```js
import { VoultClient } from 'voult-sdk';

const voult = new VoultClient({
  baseUrl: process.env.VOULT_BASE_URL,
  clientId: process.env.VOULT_CLIENT_ID,
  clientSecret: process.env.VOULT_CLIENT_SECRET,
});

// Examples (method names may match SDK README — map 1:1 to HTTP below):
// await voult.register({ email, password, fullName });
// await voult.login({ email, password });
// await voult.refresh({ refreshToken });
// await voult.me({ accessToken });
```

If a method is missing in the SDK for a feature below, call the HTTP endpoint from your BFF — still auth-only; still no Voult UI.

---

## 4. Recommended architecture (BFF)

**Do not** put `VOULT_CLIENT_SECRET` in a SPA or mobile app.

```
Browser / Mobile  →  Your backend (BFF)  →  Voult API
                         ↑
                   holds client secret
                   stores access/refresh
                   (session, encrypted DB, or secure cookie)
```

Your frontend talks only to **your** routes (`/auth/login`, `/auth/mfa`, …). Your backend proxies to Voult and returns a session shape your app already understands.

---

## 5. Quick start

Minimal path: register → verify email → login → call `/api/user/me` → refresh → logout.

### Headers (canonical)

```http
Content-Type: application/json
X-Client-Id: app_...
X-Client-Secret: ...
```

After login, add:

```http
Authorization: Bearer <accessToken>
```

### Register

`POST {VOULT_BASE_URL}/api/auth/register`

```json
{
  "fullName": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "Str0ng!Pass"
}
```

Typical success shape:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "emailVerificationRequired": true,
  "user": { "id": "...", "email": "ada@example.com" }
}
```

Treat register tokens as **unverified**. Login is blocked until the user verifies email (`EMAIL_NOT_VERIFIED`).

### Login

`POST {VOULT_BASE_URL}/api/auth/email-login`

```json
{ "email": "ada@example.com", "password": "Str0ng!Pass" }
```

Success (no MFA):

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "email": "ada@example.com" }
}
```

MFA step-up (do **not** store tokens yet):

```json
{
  "mfaRequired": true,
  "mfaPendingToken": "..."
}
```

### Profile

`GET {VOULT_BASE_URL}/api/user/me`  
Headers: `Authorization: Bearer <accessToken>`

### Refresh

`POST {VOULT_BASE_URL}/api/sessions/refresh`

```json
{ "refreshToken": "..." }
```

Always persist the **new** refresh token (rotation). See [§8](#8-csrf--server-to-server-caveats) — this route currently requires CSRF.

### Logout

`POST {VOULT_BASE_URL}/api/auth/logout`  
Headers: client credentials + `Authorization: Bearer <accessToken>`

Revokes refresh tokens and bumps `tokenVersion` so old access tokens stop working.

---

## 6. Feature-by-feature implementation

For each feature: what **your app** builds, what **Voult** owns, and the calls to make.

---

### 6.1 Email / password registration & login

| Your app | Voult |
|----------|-------|
| Signup / login forms, validation UX | Hashing, uniqueness per app, lockout, email verification gate |
| Store tokens after successful login | Issue `accessToken` + `refreshToken` |

| Method | Path | Client secret | End-user JWT |
|--------|------|---------------|--------------|
| `POST` | `/api/auth/register` | ✅ | — |
| `POST` | `/api/auth/username-register` | ✅ | — |
| `POST` | `/api/auth/email-login` | ✅ | — |
| `POST` | `/api/auth/username-login` | ✅ | — |
| `POST` | `/api/auth/logout` | ✅ | ✅ |

**Implement in your codebase**

1. BFF routes: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`.
2. On login success without MFA → create **your** session (cookie / store tokens).
3. On `mfaRequired` → keep `mfaPendingToken` in a short-lived server session and show TOTP UI ([§6.3](#63-mfa-totp)).
4. Map Voult error codes to user-facing messages ([§9](#9-error-handling)).

**Lockout:** 5 failed logins → ~15 minutes locked (`ACCOUNT_LOCKED`). Show a calm message; do not reveal whether the email exists beyond what Voult already returns.

---

### 6.2 Email verification

| Your app | Voult |
|----------|-------|
| “Check your inbox” UX; optional deep-link landing page | Sends verification email; `GET /api/user/verify-email?token=&appId=` |

**Implement**

1. After register, tell the user to verify email before login.
2. Verification link currently hits **Voult** (`BASE_URL` + `/api/user/verify-email?...`). Plan UX around that (or poll login until verification succeeds).
3. Do not grant privileged product access on register tokens while `emailVerificationRequired` is true.

---

### 6.3 MFA (TOTP)

Full guide: [MFA_TOTP_GUIDE.md](../security_imp/MFA_TOTP_GUIDE.md).

| Your app | Voult |
|----------|-------|
| Settings UI: enable / disable MFA, show QR + backup codes once | Secret generation, QR payload, backup hashing, verify, lockout |
| Two-step login UI | `mfaPendingToken` JWT (short-lived) |

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/auth/mfa/setup` | Bearer + client headers → `qrCode`, `secret`, `backupCodes` |
| `POST` | `/api/auth/mfa/enable` | Body: `{ token }` (TOTP) |
| `POST` | `/api/auth/mfa/verify` | Login step-up: `{ mfaPendingToken, mfaToken }` → tokens |
| `GET` | `/api/auth/mfa/status` | Enrollment state |
| `POST` | `/api/auth/mfa/disable` | Authenticated |
| `POST` | `/api/auth/mfa/backup-codes/regenerate` | Authenticated |

**Login flow in your app**

```
password login → if mfaRequired → collect TOTP/backup → POST /mfa/verify → then store tokens
```

Never persist `accessToken` / `refreshToken` until MFA verify succeeds.

---

### 6.4 WebAuthn / passkeys

Full guide: [WEBAUTHN_GUIDE.md](../security_imp/WEBAUTHN_GUIDE.md).

| Your app | Voult |
|----------|-------|
| Call `navigator.credentials.create` / `.get` in the browser | Challenges, credential storage, verification |
| Proxy options/verify through your BFF | Issues tokens on login verify |

| Method | Path |
|--------|------|
| `GET` | `/api/auth/webauthn/compatibility` |
| `POST` | `/api/auth/webauthn/register/options` |
| `POST` | `/api/auth/webauthn/register/verify` |
| `POST` | `/api/auth/webauthn/login/options` |
| `POST` | `/api/auth/webauthn/login/verify` |
| `GET` | `/api/auth/webauthn/credentials` |
| `PATCH` / `DELETE` | `/api/auth/webauthn/credentials/:id` |

**Implement**

1. Registration only for an already-logged-in user (Bearer).
2. Login: options → browser assertion → verify → store tokens.
3. Keep WebAuthn ceremony in the browser; keep client secret on the server.

---

### 6.5 Magic link (passwordless email)

Full guide: [MAGIC_LINK_AUTHENTICATION_GUIDE.md](../features/MAGIC_LINK_AUTHENTICATION_GUIDE.md).

| Your app | Voult |
|----------|-------|
| “Email me a link” form; callback page that reads `?token=` | Token minting, email send, one-time claim, JWT issue |
| Allowlist `redirectUri` in Voult app settings | Validates redirect against allowlist |

| Method | Path | Auth notes |
|--------|------|------------|
| `POST` | `/api/send-magic-link` | Body: `{ email, clientId, redirectUri }` — **no client secret**; CSRF currently required |
| `POST` | `/api/validate-magic-link` | Body: `{ token }` → tokens; CSRF currently required |

**Implement**

1. User requests link → your BFF calls send (or browser flow if you accept CSRF session constraints).
2. Email opens `{redirectUri}?token=...` on **your** domain.
3. Your callback page/BFF calls validate → store tokens → clear token from URL (replaceState) so it is not logged or referrer-leaked.

---

### 6.6 OAuth social sign-in

Full guide: [OAUTH_TESTING_AND_IMPLEMENTATION_GUIDE.md](../oauth/OAUTH_TESTING_AND_IMPLEMENTATION_GUIDE.md).

**Recommended model (Model A):** your app completes the provider OAuth dance, then sends the provider token/code to Voult.

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/api/auth/google/register` · `/login` | `X-Client-Id` (secret optional on some OAuth routes); CSRF currently required |
| `POST` | `/api/auth/github/register` · `/login` | same |
| `POST` | `/api/auth/facebook/...` | same |
| `POST` | `/api/auth/linkedin/...` | same |
| `POST` | `/api/auth/microsoft/...` | Prefer verifying mount paths against your deployed Voult version |

**Deprecated:** legacy `POST /api/:provider/authorize` + callback (sunset targeted 2026-12-31). Do not build new apps on Model B.

**Account linking** (logged-in user):

| Method | Path |
|--------|------|
| `POST` | `/api/oauth/:provider/link` |
| `GET` | `/api/me/oauth-accounts` |
| `DELETE` | `/api/me/oauth-accounts/:provider` |
| `POST` | `/api/me/set-password` |

**Implement**

1. Configure provider apps (Google/GitHub/…) with **your** redirect URIs.
2. Configure the same providers on your Voult App (dashboard).
3. After provider success, call Voult login/register with the provider credential payload your Voult version expects.
4. Store returned Voult tokens like password login.
5. Offer “Set password” for social-only accounts before unlinking the last provider.

---

### 6.7 Sessions & token refresh

Full guide: [TOKEN_SECURITY_AND_MANAGEMENT.md](../features/TOKEN_SECURITY_AND_MANAGEMENT.md).

| Your app | Voult |
|----------|-------|
| Persist refresh token securely; refresh before access expiry | Access JWT (~15m prod), refresh rotation, reuse detection |
| “Active sessions” UI if desired | List / revoke sessions |

| Method | Path |
|--------|------|
| `GET` | `/api/sessions` |
| `GET` | `/api/sessions/revoke/:sessionId` |
| `POST` | `/api/sessions/refresh` |

**Implement**

1. On every authenticated BFF call, ensure access token is valid (refresh if near expiry).
2. On `REFRESH_TOKEN_REUSE_DETECTED`, force full re-login (all sessions may be killed).
3. On logout, call Voult logout **and** clear your local session.

---

### 6.8 Password reset

| Method | Path |
|--------|------|
| `POST` | `/api/user/forgot-password` |
| `POST` | `/api/user/reset-password` |

Both currently use **CSRF** + client credentials. Prefer calling them from a flow that can supply CSRF, or from a BFF that has solved the CSRF session dance ([§8](#8-csrf--server-to-server-caveats)).

**Implement:** forgot-password form → email → reset form with token from email → reset-password → redirect to login.

---

### 6.9 Profile & account lifecycle

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/api/user/me` | Bearer |
| `PATCH` | `/api/user/me` | Bearer (+ CSRF today) |
| `POST` | `/api/user/disable` | Bearer (+ CSRF) |
| `POST` | `/api/user/reenable` | Bearer (+ CSRF) |

**Implement:** settings pages that proxy these calls. After disable, clear local session. Product authorization (roles, entitlements) stays in **your** DB keyed by Voult `user.id`.

---

### 6.10 IP allowlist (app-level)

Guide: [IP_ALLOWLIST_GUIDE.md](../security_imp/IP_ALLOWLIST_GUIDE.md).

Enforced automatically after client verification when enabled for your App. Management APIs are for the **developer portal session**, not for end users.

**Implement in your app:** handle `403` / allowlist errors gracefully (VPN, office IP changes). Do not try to manage the allowlist from the end-user product unless you are building an admin tool that uses developer auth.

---

### 6.11 Rate limits & audit visibility

| Concern | Behavior |
|---------|----------|
| Global / auth rate limits | `429` — back off; show “try again later” |
| Per-email login limits | Protects against credential stuffing |
| End-user audit | `GET /api/audit-logs/me` (when enabled for your deployment) |

**Implement:** map `429` and lockout codes in your UI; optionally show “recent security activity” from audit logs. Do not re-implement rate limiting against Voult as a substitute for Voult’s own limits.

---

## 7. Headers & auth layers

| Layer | Headers / body | Purpose |
|-------|----------------|---------|
| App credentials | `X-Client-Id`, `X-Client-Secret` | Proves the caller is your App |
| End-user access | `Authorization: Bearer <accessToken>` | Proves which end user |
| Refresh | Body `{ refreshToken }` | New token pair (no client secret required on refresh today) |
| OAuth (some routes) | `X-Client-Id` only (`verifyClientIdOnly`) | Weaker binding — keep redirects tight |

Canonical client auth is **`X-Client-Id` + `X-Client-Secret`**. Do not follow older comments that say `Authorization: Bearer <client_secret>` for the app secret.

---

## 8. CSRF & server-to-server caveats

Core password routes under `/api/auth/register|…-login|logout` are intended for SDK / BFF use **without** CSRF.

Several other routes still attach `csrfProtection` in this codebase, including:

- `POST /api/sessions/refresh`
- Magic link send / validate
- OAuth provider login/register
- Forgot / reset password
- Profile patch, disable / reenable
- OAuth linking / set-password

**Implications for an auth-only integrator**

1. Prefer the **main path**: register → verify → email-login → MFA → logout for production MVP.
2. For CSRF-protected routes, either:
   - call them from a browser context that can obtain a Voult CSRF cookie/token (usually wrong for pure BFF), or
   - track Voult releases that remove CSRF from pure API routes (see [csrf_fix.md](../bug_fix/csrf_fix.md)), or
   - temporarily use documented workarounds only if your deployment provides them.
3. `voult-sdk` correctly does **not** implement browser CSRF — it expects API routes to accept client credentials alone.

When in doubt, verify with a single `curl`/SDK call against your target environment before building UI.

---

## 9. Error handling

Voult errors:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "status": 401
  }
}
```

| Code | What your UI should do |
|------|------------------------|
| `INVALID_CREDENTIALS` | Generic “wrong email or password” |
| `EMAIL_NOT_VERIFIED` | Prompt to verify email |
| `ACCOUNT_LOCKED` | Wait / support message (~15 min) |
| `ACCOUNT_DISABLED` | Account disabled messaging |
| `WEAK_PASSWORD` / `VALIDATION_ERROR` | Show field errors |
| `USER_EXISTS` / `USERNAME_TAKEN` | Conflict on signup |
| `INVALID_CLIENT` / `INVALID_CLIENT_SECRET` | Your server misconfiguration — log, don’t show to users |
| `UNAUTHORIZED` | Refresh or re-login |
| `REFRESH_TOKEN_REUSE_DETECTED` | Force re-login everywhere |
| `INVALID_REFRESH_TOKEN` / `REFRESH_TOKEN_EXPIRED` | Re-login |

SDK typed errors (when using `voult-sdk`) map onto these codes (`AuthenticationError`, `AccountLockedError`, `ValidationError`, etc.). Catch by type in the BFF; never leak stack traces to the client.

---

## 10. Security checklist for your app

- [ ] `VOULT_CLIENT_SECRET` only on the server
- [ ] Callback / redirect URLs allowlisted in the Voult App
- [ ] Tokens not stored in `localStorage` for browser apps (prefer HttpOnly cookie or memory + BFF session)
- [ ] No product access before email verification (and before MFA when required)
- [ ] Refresh token rotation: always save the new refresh token
- [ ] Logout clears local session **and** calls Voult logout
- [ ] OAuth uses Model A (`/api/auth/{provider}/*`), not legacy authorize/callback
- [ ] Magic link tokens stripped from URL after exchange
- [ ] Your authorization (roles) is **not** inferred from Voult alone unless you intentionally store claims in your DB

---

## 11. Endpoint map

Quick reference for auth-only integration. Base: `{VOULT_BASE_URL}`.

| Feature | Endpoints |
|---------|-----------|
| Password auth | `POST /api/auth/register`, `/username-register`, `/email-login`, `/username-login`, `/logout` |
| MFA | `/api/auth/mfa/*` |
| WebAuthn | `/api/auth/webauthn/*` |
| Sessions | `GET /api/sessions`, `GET /api/sessions/revoke/:id`, `POST /api/sessions/refresh` |
| User | `GET|PATCH /api/user/me`, `/verify-email`, `/forgot-password`, `/reset-password`, `/disable`, `/reenable` |
| Magic link | `POST /api/send-magic-link`, `/validate-magic-link` |
| OAuth | `POST /api/auth/{google\|github\|facebook\|linkedin\|microsoft}/login\|register` |
| OAuth linking | `/api/oauth/:provider/link`, `/api/me/oauth-accounts`, `/api/me/set-password` |
| Audit (end user) | `GET /api/audit-logs/me` |

Interactive API explorer (when enabled on the server): `{VOULT_BASE_URL}/docs`.

---

## 12. What you should not build

Because Voult is **auth only** for your product:

| Do not re-implement | Use instead |
|---------------------|-------------|
| Password hashing / reset email plumbing | Voult register + forgot/reset |
| TOTP secret storage | Voult MFA endpoints |
| Passkey crypto | Voult WebAuthn + browser WebAuthn API |
| Refresh-token DB schema for Voult’s tokens | Store opaque tokens Voult returns; let Voult rotate/revoke |
| Global identity provider UI hosted by you that talks to providers *and* duplicates Voult’s user table | Model A OAuth → Voult issues the user |

You **should** still build: signup/login/settings UI, your session cookie, your product database, and your own authorization.

---

## Suggested implementation order (another codebase)

1. BFF + env credentials + register / email-login / me / logout  
2. Email verification UX  
3. Token refresh + session storage  
4. MFA enrollment + login step-up  
5. Password reset  
6. OAuth (Google + GitHub first)  
7. Magic link **or** WebAuthn (pick one passwordless path for MVP)  
8. Session list / revoke + audit “security activity” (nice-to-have)

That sequence matches a stranger installing `voult-sdk` (or raw HTTP) and shipping working auth without depending on any non-auth Voult feature.
