Voult as an application: 7 / 10
Solid foundation for a B2B auth platform, but not enterprise-grade yet. The main /api/auth/* path is meaningfully stronger than the rest of the platform.

What’s strong (why it’s not lower)
Area	Rating	Notes
Core password auth
8/10
bcrypt (cost 12), lockout, generic errors, email verification enforced at login
Token model
8/10
Short-lived access tokens (15m prod), refresh rotation, reuse detection, tokenVersion invalidation
MFA
7.5/10
TOTP + backup codes, lockout, pending JWT step-up
Rate limiting
7.5/10
Per-IP, per-email, per-user; Redis with in-memory failover
Query safety
7.5/10
SafeQueryBuilder used broadly
Headers & transport
7/10
Helmet, HSTS, CSP (with unsafe-inline), CORS allowlist
Audit logging
7/10
Auth/MFA events, risk scoring, retention
App isolation
7/10
Users scoped per app; client secrets bcrypt-hashed
What pulls the score down
Issue	Severity	Impact
Client secrets logged in plaintext (models/app.js ~146)
Critical
Any log aggregator exposes every app’s client secret
Global CSRF disabled; web login/register/logout unprotected
High
Developer portal vulnerable to CSRF
Register returns JWT before email verification
Medium
Token usable on routes that don’t check isEmailVerified
Audit API needs only client secret
High
Leaked secret = full audit history for that app
OAuth routes skip client secret (Google, GitHub, etc.)
Medium
Weaker app binding on those flows
Legacy controllers/api/oauth.js
High
Unsigned state, cross-app user lookup bugs
Disable account doesn’t revoke tokens
Medium
Disabled users may keep valid refresh tokens
Public Swagger at /docs
Low–Med
Full API surface exposed
7-day JWT expiry in non-production
Low
Dev tokens live too long
Certification doc claims 10/10
—
WebAuthn, tamper-proof audit, pen tests not actually done
Score by surface
Core API auth (/api/auth/*, MFA, sessions)     →  7.5–8 / 10
Developer web portal (EJS, Passport)          →  5.5–6 / 10
Legacy OAuth / magic-link paths               →  5–6 / 10
Overall platform                              →  7 / 10
Bottom line: Fine for dev/staging and cautious production on the main auth path. Fix client-secret logging, CSRF on the developer portal, and audit API authorization before calling it enterprise-ready.

Consumer apps using the Voult API: 6.5 / 10 (typical), up to 7.5 / 10 if integrated well
Consumer app security is mostly Voult’s auth quality plus how the integrator uses it. Voult gives good primitives, but the API has footguns that make mistakes easy.

What integrators inherit (the good)
bcrypt password storage (not their problem)
Account lockout and MFA
Refresh token rotation with reuse detection
Callback URL allowlisting
Per-app user isolation
Audit trail for auth events
What integrators must get right
Responsibility	Risk if wrong
Keep X-Client-Secret server-side only
Full impersonation of the app
Treat register token as unverified
Access before email confirmation
Use accessToken + refreshToken from login, not register token
Wrong token type / no rotation
Handle MFA two-step flow (mfaPendingToken → /mfa/verify)
Login appears broken
CSRF on refresh, magic link, password reset
Server/mobile apps need session + CSRF token
Allowlist callback URLs in Voult dashboard
Open redirect / token theft
Never put magic link tokens in logs/referrers
Token leaked via URL
API inconsistencies that hurt integrators
Register  →  { token }                    (single JWT, no refresh pair)
Login     →  { accessToken, refreshToken }
MFA login →  two-step flow
OAuth     →  some routes need only X-Client-Id (no secret)
Refresh   →  needs CSRF + no client auth
OpenAPI   →  documents Bearer auth; code uses x-client-secret header
A careful backend integration using only /api/auth/email-login + MFA + refresh, with secrets in env vars: ~7.5/10.

A typical SPA/mobile integration hitting mixed endpoints without reading the docs closely: ~5.5–6/10.

Summary
Target	Score	One-line summary
Voult platform
7 / 10
Strong core auth; portal, legacy routes, and ops gaps hold it back
Consumer apps (well integrated)
7.5 / 10
Inherits most of Voult’s strengths if they follow the main auth path
Consumer apps (typical)
6.5 / 10
API inconsistencies and integration footguns create real risk
Certification doc claim
10 / 10
Aspirational — not supported by current implementation
Top 5 fixes to move Voult toward 8.5+
Remove client secret from logs (models/app.js)
Enable CSRF on developer web routes (login, register, app creation)
Require developer auth (not just client secret) for audit log APIs
Revoke refresh tokens + bump tokenVersion on account disable
Align API contract: consistent token responses, document x-client-secret, mark legacy OAuth deprecated