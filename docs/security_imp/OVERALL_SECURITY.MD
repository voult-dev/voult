# Voult Security Assessment

## Voult as an application: 8.5 / 10

Strong B2B auth platform with a hardened developer portal and consistent API contract. The main `/api/auth/*` path is production-ready for careful deployments.

### What's strong (why it's not lower)

| Area | Rating | Notes |
|------|--------|-------|
| Core password auth | 8/10 | bcrypt (cost 12), lockout, generic errors, email verification enforced at login |
| Token model | 8.5/10 | Short-lived access tokens (15m prod), refresh rotation, reuse detection, tokenVersion invalidation on disable/logout |
| MFA | 7.5/10 | TOTP + backup codes, lockout, pending JWT step-up |
| Rate limiting | 7.5/10 | Per-IP, per-email, per-user; Redis with in-memory failover |
| Query safety | 7.5/10 | SafeQueryBuilder used broadly |
| Headers & transport | 7/10 | Helmet, HSTS, CSP (with unsafe-inline), CORS allowlist |
| Audit logging | 8/10 | Auth/MFA events, risk scoring, retention; developer-session required for admin audit APIs |
| App isolation | 7/10 | Users scoped per app; client secrets bcrypt-hashed |
| Developer portal | 8/10 | CSRF on login/register/logout/app creation, Passport sessions, IP rate limits, app ownership checks |

### Remaining gaps (what holds it below 9+)

| Issue | Severity | Impact |
|-------|----------|--------|
| OAuth routes skip client secret on some provider flows | Medium | Weaker app binding on Google/GitHub login/register |
| Legacy `controllers/api/oauth.js` still active (deprecated) | Medium | Unsigned state; migrate to `/api/auth/{provider}/*` before sunset 2026-12-31 |
| Register returns tokens before email verification | Low–Med | `emailVerificationRequired: true` flagged; login still blocked until verified |
| Public Swagger at `/docs` | Low–Med | Full API surface exposed |
| 7-day JWT expiry in non-production | Low | Dev tokens live too long |
| Certification doc aspirational items | — | WebAuthn, tamper-proof audit, pen tests not yet done |

### Score by surface

| Surface | Score |
|---------|-------|
| Core API auth (`/api/auth/*`, MFA, sessions) | 8 / 10 |
| Developer web portal (EJS, Passport) | 8 / 10 |
| Legacy OAuth / magic-link paths | 5.5–6 / 10 |
| **Overall platform** | **8.5 / 10** |

**Bottom line:** Production-ready on the main auth path and developer portal after the hardening pass. Migrate off legacy OAuth and tighten provider-specific flows for enterprise readiness.

---

## Consumer apps using the Voult API: 7 / 10 (typical), up to 8 / 10 if integrated well

Consumer app security is mostly Voult's auth quality plus how the integrator uses it.

### What integrators inherit (the good)

- bcrypt password storage (not their problem)
- Account lockout and MFA
- Refresh token rotation with reuse detection
- Callback URL allowlisting
- Per-app user isolation
- Audit trail for auth events
- Consistent `{ accessToken, refreshToken }` on register and login

### What integrators must get right

| Responsibility | Risk if wrong |
|----------------|---------------|
| Keep `X-Client-Secret` server-side only | Full impersonation of the app |
| Treat register tokens as unverified | Access before email confirmation on routes without verification checks |
| Use `accessToken` + `refreshToken` from login, not legacy `token` field | Wrong token type / no rotation |
| Handle MFA two-step flow (`mfaPendingToken` → `/mfa/verify`) | Login appears broken |
| CSRF on refresh, magic link, password reset | Server/mobile apps need session + CSRF token |
| Allowlist callback URLs in Voult dashboard | Open redirect / token theft |
| Never put magic link tokens in logs/referrers | Token leaked via URL |

### API contract (aligned)

```
Register  →  { accessToken, refreshToken, emailVerificationRequired: true, user }
Login     →  { accessToken, refreshToken, user }  OR  { mfaRequired, mfaPendingToken }
MFA login →  two-step flow
Refresh   →  needs CSRF + no client auth
Headers   →  X-Client-Id + X-Client-Secret (documented in OpenAPI)
OAuth     →  legacy /api/{provider}/* deprecated; use /api/auth/{provider}/*
```

A careful backend integration using only `/api/auth/email-login` + MFA + refresh, with secrets in env vars: **~8 / 10**.

A typical SPA/mobile integration hitting mixed endpoints without reading the docs closely: **~7 / 10**.

---

## Summary

| Target | Score | One-line summary |
|--------|-------|------------------|
| Voult platform | **8.5 / 10** | Hardened core auth and developer portal; legacy OAuth is the main remaining gap |
| Consumer apps (well integrated) | **8 / 10** | Inherits Voult's strengths when following the main auth path |
| Consumer apps (typical) | **7 / 10** | Integration footguns still create real risk |
| Certification doc claim | 10 / 10 | Aspirational — not supported by current implementation |

---

## Hardening completed (2026)

| Fix | Status |
|-----|--------|
| Remove client secret from logs (`models/app.js`) | ✅ Done |
| Enable CSRF on developer web routes (login, register, app creation) | ✅ Done |
| Require developer auth (not just client secret) for audit log APIs | ✅ Done |
| Revoke refresh tokens + bump `tokenVersion` on account disable | ✅ Done |
| Align API contract: consistent token responses, document `x-client-secret`, mark legacy OAuth deprecated | ✅ Done |

### Remaining top fixes toward 9+

1. Enforce email verification on all token-gated routes (middleware)
2. Require client secret on all OAuth provider routes
3. Remove or sunset legacy `controllers/api/oauth.js` entirely
4. Restrict `/docs` to authenticated developers in production
5. Shorten non-production JWT expiry
