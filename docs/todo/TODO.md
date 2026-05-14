# TODO
A centralized authentication-as-a-service platform for developers.

---

## ✅ MVP – COMPLETE (API-FIRST)

### 🔐 Core Authentication (End Users)
- [x] Register (email + password)
- [x] Login
- [x] Logout (JWT revocation via tokenVersion)
- [x] Get current user (`/me`)
- [x] Email verification flow
- [x] Resend verification email (rate-limited)
- [x] Password reset (forgot + reset)
- [x] Password strength enforcement
- [x] Soft delete / disable account
- [x] Re-enable account
- [x] Prevent login for disabled accounts
- [x] Prevent login for unverified emails

---

### 🧩 App / Client Authentication
- [x] Client ID + Client Secret auth
- [x] Secure client secret hashing
- [x] Client secret rotation
- [x] App enable / disable
- [x] Callback URL allowlist validation
- [x] Per-app usage tracking (logins, registrations)
- [x] App soft delete support

---

### 🛡 Security & Abuse Protection
- [x] Rate limiting (API + auth routes)
- [x] Token expiration handling
- [x] Token revocation on logout / password reset
- [x] Consistent API error format (`ApiError`)
- [x] Centralized API error handler
- [x] Request + auth failure logging

---

### 📄 Developer Experience
- [x] Swagger / OpenAPI documentation
- [x] Postman collection
- [x] Example Node.js SDK
- [x] Example API usage flows
- [x] Clear separation of Web vs API auth logic

---

### 🧠 Architecture Quality
- [x] Modular middleware structure
- [x] CatchAsync error handling
- [x] Joi validation layer
- [x] Clean folder separation (controllers, services, validators)
- [x] Environment-based configuration
- [x] Production-ready JWT handling

---

## 🚀 V1 – NEXT MAJOR RELEASE

### 🔐 Authentication & Sessions
- [x] Refresh token support (short-lived access tokens)
- [x] Refresh token rotation + reuse detection
- [x] Session tracking (list active sessions)
- [x] Revoke specific sessions
- [x] Account lockout after repeated failed logins
- [x] Send Email to the endUser about the lockout

---

### BASIC FEATURES FOR THE API.
- [x] Edit Profile (extra authentication for the email)

### THIRD PARTY APPS AUTHENTICATION
- [x] Login with Google
- [x] Login with GitHub
- [x] Login with Facebook
- [x] login with apple.
- [x] login with microsoft.

- [ ] OAuth account linking (password ↔ social) *
- [x] Handle existing email collisions across providers
- [ ] Store provider metadata (providerId, avatar, profile) *
- [x] Per-app enable / disable social providers

### 🧩 OAuth Provider Configuration
- [x] Configure OAuth credentials per app
  - [x] Google Client ID & Secret
  - [x] GitHub Client ID & Secret
  - [x] Facebook App ID & Secret
  - [x] Linkeldn App ID & Secret
  - [x] Apple App ID & Secret
  - [x] Microsoft App ID & Secret
- [ ] OAuth redirect URI allowlist *
- [x] Environment-specific OAuth configs (dev / prod)
- [ ] Add passwordless authentication
    - [x] Magic Link

---

### Main App Features

## Backend Features.
- [x] Add resend email to forgotten password flow
- [x] Add settings page to the frontend of the app.
- [x] Enable developer google oauth login and register
- [x] Enable developer github oauth login and register
- [ ] Let user decide the password format/logic for their app.
- [ ] Add a copy button to the appID and maybe the clientSecret

## Frontend Features.
- [ ] Look for a good template and good color pallete for this app.
- [ ] Create a good/captivating landing page.
- [ ] Restyle the entire app.
- [ ] Add API Usage Page to the main app
- [x] Differentiate between the dashboard page and the apps list page
- [ ] Add more features to the main app.

### 📊 App Insights & Auditing
- [ ] App usage dashboard
- [ ] Auth metrics (daily logins, registrations)
- [ ] Audit logs per app
- [ ] Auth event timeline
- [ ] Export logs (CSV / JSON)

---

### 🧠 Developer Experience (V1)
- [ ] SDK refresh token helpers
- [ ] OAuth helpers in SDK
- [ ] More SDK examples (Next.js, Express)
- [ ] OAuth flow diagrams
- [ ] Improved Swagger UI polish
- [ ] Versioned API docs (`/v1`, `/v2`)

---

## 🌱 V2

### Publish Method
- [ ] Create an SDK for this API.
- [ ] Make it have two ways of integration, the NPM, yarn, pnpm, bun etc and the other axios/fetch method from voult.dev directly.

### BASIC MULTI FACTOR AUTHENTICATION
- [ ] Optional MFA (email OTP)

### 🏢 Enterprise Features
- [ ] Organizations / Teams
- [ ] Role-based access control (RBAC)
- [ ] SSO (SAML / OIDC)
- [ ] IP allowlisting
- [ ] Advanced MFA (TOTP, WebAuthn)

---

### 🧪 Platform Enhancements
- [ ] Webhooks for auth events
- [ ] Web-based admin dashboard
- [ ] Billing & plans
- [ ] Usage-based limits
- [ ] Custom branding (emails, hosted pages)
- [ ] Add the support page to the codebase

---

## 🎯 Definition of Done

- Secure, scalable auth platform
- Password + social authentication supported
- OAuth configurable per app
- Clear, consistent API responses
- Observable, auditable auth flows
- Developer-first experience

---

voult.dev  -->

