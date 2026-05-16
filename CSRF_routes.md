# Routes that Require CSRF Protection

The application applies CSRF protection globally in `src/index.js`.
The following routes are state-changing endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) that require a valid CSRF token.

## Web routes

### Auth
- `POST /login`
- `POST /register`
- `POST /logout`

### User account
- `POST /forgot-password`
- `POST /reset-password/:token`
- `POST /settings`
- `POST /settings/email/request-change`
- `POST /settings/password/set`
- `POST /settings/password/change`
- `POST /settings/unlink/:provider`
- `POST /delete-account`

### App management
- `POST /app`
- `POST /app/:id/toggle`
- `DELETE /app/:id`
- `PUT /app/:id`
- `POST /app/:id/rotate-secret`
- `POST /app/:id/google-oauth`
- `POST /app/:id/github-oauth`
- `POST /app/app/:id/update-google-oauth`
- `POST /app/app/:id/update-github-oauth`
- `POST /app/:id/facebook-oauth`
- `POST /app/:id/update-facebook-oauth`
- `POST /app/:id/linkedin-oauth`
- `POST /app/:id/update-linkedin-oauth`
- `POST /app/:id/apple-oauth`
- `POST /app/:id/update-apple-oauth`
- `POST /app/:id/microsoft-oauth`
- `POST /app/:id/update-microsoft-oauth`

## API routes

### Auth
- `POST /api/auth/register`
- `POST /api/auth/username-register`
- `POST /api/auth/email-login`
- `POST /api/auth/username-login`
- `POST /api/auth/logout`

### User
- `POST /api/user/forgot-password`
- `POST /api/user/reset-password`
- `POST /api/user/disable`
- `POST /api/user/reenable`
- `PATCH /api/user/me`

### OAuth providers
- `POST /api/auth/google/register`
- `POST /api/auth/google/login`
- `POST /api/auth/github/register`
- `POST /api/auth/github/login`
- `POST /api/auth/facebook/register`
- `POST /api/auth/facebook/login`
- `POST /api/auth/linkedin/register`
- `POST /api/auth/linkedin/login`
- `POST /api/auth/microsoft/register`
- `POST /api/auth/microsoft/login`
- `POST /api/auth/apple/register`
- `POST /api/auth/apple/login`

### Sessions
- `POST /api/sessions/refresh`

### OAuth / provider linking
- `POST /api/:provider/authorize`
- `POST /api/oauth/:provider/link`
- `POST /api/me/set-password`
- `DELETE /api/me/oauth-accounts/:provider`
- `DELETE /api/me/oauth/:provider`

### Magic link
- `POST /api/send-magic-link`
- `POST /api/validate-magic-link`

## Notes
- API routes under `/api` are also subject to CSRF protection because `src/index.js` applies CSRF middleware globally and enforces `x-csrf-token` or `_csrf` for `/api` requests.
- The web forms in `views/` should include a hidden `_csrf` field for the corresponding routes listed above.
