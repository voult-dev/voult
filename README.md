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
- [x] Comprehensive TODO documentation with detailed feature tracking
- [x] Email service configuration updates for consistency
- [x] Javascript SDK (WIP)

---
This project is 4 months away from launch.
