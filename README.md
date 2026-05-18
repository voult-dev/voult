# Voult.dev — Authentication as a Service for Developers.

Voult.dev is a **developer-first authentication platform** that provides secure, scalable, and easy-to-integrate authentication APIs for modern web applications.

It handles the hard parts of auth — user management, email verification, password resets, magic links, OAuth integration, JWT handling, and account security — so developers can focus on building products, not auth systems.

---

Live: https://www.voult.dev  

---

##  Features

### Core Authentication.
- User registration (email + password, or username + password)
- Secure login & logout (email-based or username-based)
- Magic link authentication (passwordless login)
- JWT-based authentication with token versioning
- Email verification flow
- Password reset (forgot & reset)
- Password strength enforcement
- Prevent login for:
  - Unverified emails
  - Disabled accounts

### OAuth Support.
- OAuth middleware for API routes
- Multi-provider configuration (in development)
- Seamless provider integration

### Account Management.
- Soft delete (disable account)
- Re-enable disabled accounts
- Token revocation via `tokenVersion`
- Current user (profile) endpoint (`/me`)
- Username and email-based account lookup

### Developer-Focused.
- API-first architecture
- Clean MVC structure
- Built for extensibility
- SDK support (WIP)
- Rate-limited sensitive endpoints
- Comprehensive input validation
- Atomic operations for data integrity

---

##  Tech Stack.

- **Backend**: Node.js, Express
- **Auth**: JWT, OAuth middleware
- **Database**: MongoDB + Mongoose
- **Templating**: EJS (for emails & views)
- **Security**: bcrypt, rate limiting, validation middleware, atomic transactions
- **Frontend (Landing / Docs)**: HTML, CSS, JavaScript, React.js
## CSRF Token Handling for Clients

This application uses `csurf` to protect all state-changing routes.

### Browser forms
- HTML forms include a hidden field named `_csrf`.
- The CSRF token is injected into EJS templates as `csrfToken`.
- Example:
  ```html
  <input type="hidden" name="_csrf" value="<%= csrfToken %>">
  ```

### JavaScript clients / API calls
- A client can fetch a fresh token from `GET /auth/csrf-token`.
- The app exposes this endpoint for JS-based workflows.
- Use the token in subsequent requests with the `X-CSRF-Token` header.

Example fetch flow:
```javascript
const response = await fetch('/auth/csrf-token', {
  method: 'GET',
  credentials: 'include'
});
const { token } = await response.json();

const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token
  },
  body: JSON.stringify({ email, password })
});
```

### Notes
- CSRF protection applies to web routes and API routes that mutate state.
- API requests require either the `X-CSRF-Token` header or `_csrf` query/body token.
- The server also uses session-based CSRF tokens, so `credentials: 'include'` is required for cross-origin-safe requests.
---

## 📂 Project Structure

```bash
voult/
├── config/          # App & auth configuration
├── controllers/     # Request handlers (auth, users, OAuth, magic links, etc.)
├── models/          # Mongoose schemas
├── routes/          # API routes
├── services/        # Business logic (tokens, email, OAuth, magic links, etc.)
├── validators/      # Input validation logic
├── utils/           # Shared utilities
├── views/           # EJS templates
├── public/          # Static assets
├── TODO.md          # Product roadmap
└── structure.md     # Architecture notes
```

---

##  Latest Updates

**Recent Enhancements (May 2026):**
- [x] Enhanced magic link functionality with atomic token claiming and redirect URI allowlisting (WIP)
- [x] API rate limiting for magic link routes
- [x] JWT middleware improvements for cleaner user data handling
- [x] Username-based authentication (registration & login)
- [x] OAuth middleware integration for multi-provider support
- [x] Email service configuration updates for consistency
- [x] Javascript SDK

---

This project is 4 months away from launch.
