# Voult API Functions Reference

Complete reference of all API endpoints available in the Voult API for authentication and user management.

## Table of Contents

- [Core Client & Authentication](#-core-client--authentication)
- [Password Authentication - Sign Up](#-password-authentication---sign-up)
- [Password Authentication - Sign In](#-password-authentication---sign-in)
- [Passwordless Authentication - Magic Link](#-passwordless-authentication---magic-link)
- [Session Management](#-session-management)
- [OAuth Providers](#-oauth-providers)
- [User Management](#-user-management)
- [OAuth Account Linking](#-oauth-account-linking)
- [Password Reset](#-password-reset)
- [Provider Visibility](#-provider-visibility)
- [Error Classes](#-error-classes)
- [Implementation Guide](#-implementation-guide)

---

## Core Client & Authentication

### Required Headers

All API endpoints require the following headers:

| Header | Type | Required | Description |
| ------ | ---- | -------- | ----------- |
| `X-Client-Id` | string | Yes | Your application's client ID (e.g., `app_xxx`) |
| `Authorization` | string | Yes | Bearer token with client secret |

### Base URL

```
https://api.voult.dev
```

---

## Password Authentication - Sign Up

### `POST /api/auth/register`

Register a new user with email and password.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password (min 8 chars, uppercase, lowercase, number, special char) |
| `fullName` | string | No | User's full name |
| `username` | string | No | Username (3-30 chars, alphanumeric and underscores) |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'StrongPass123!',
    fullName: 'John Doe'
  })
});
```

**Response:**

```json
{
  "message": "User registered successfully",
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "username": "johndoe"
  }
}
```

**How It Works:**

1. Validates client credentials via `verifyClient` middleware
2. Sanitizes email (lowercase) and username inputs
3. Validates email format with regex
4. Validates password complexity (8+ chars, uppercase, lowercase, number, special char)
5. Validates username format if provided (3-30 chars, alphanumeric + underscore)
6. Creates user in database with hashed password
7. Generates email verification token
8. Sends verification email
9. Returns JWT token and user data

---

### `POST /api/auth/username-register`

Register a new user with username and password. Email is optional.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `username` | string | Yes | Username (3-30 chars, alphanumeric and underscores) |
| `password` | string | Yes | User's password |
| `fullName` | string | No | User's full name |
| `email` | string | No | Optional email address |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/username-register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret'
  },
  body: JSON.stringify({
    username: 'johndoe',
    password: 'StrongPass123!',
    email: 'john@example.com'
  })
});
```

**Response:**

```json
{
  "message": "User registered successfully",
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "username": "johndoe",
    "email": "john@example.com"
  }
}
```

---

## Password Authentication - Sign In

### `POST /api/auth/email-login`

Authenticate with email and password.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `email` | string | Yes | User's email |
| `password` | string | Yes | User's password |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/email-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'StrongPass123!'
  })
});
```

**Response:**

```json
{
  "message": "Login successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

**How It Works:**

1. Validates client credentials
2. Normalizes email to lowercase
3. Finds user by email
4. Checks account lock status (locked after 5 failed attempts for 15 min)
5. Verifies password with bcrypt
6. Validates email verification status
7. Validates account active status
8. Issues access token (JWT) and refresh token
9. Returns tokens and user data

---

### `POST /api/auth/username-login`

Authenticate with username and password.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `username` | string | Yes | User's username |
| `password` | string | Yes | User's password |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/username-login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret'
  },
  body: JSON.stringify({
    username: 'johndoe',
    password: 'StrongPass123!'
  })
});
```

**Response:**

```json
{
  "message": "Login successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "username": "johndoe",
    "email": "user@example.com"
  }
}
```

---

## Passwordless Authentication - Magic Link

### `POST /api/send-magic-link`

Send a magic link to the user's email for passwordless authentication.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `email` | string | Yes | User's email address |
| `clientId` | string | Yes | Application client ID |
| `redirectUri` | string | Yes | URL where user will be redirected after clicking link |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/send-magic-link', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    clientId: 'app_your-client-id',
    redirectUri: 'https://yourapp.com/callback'
  })
});
```

**Response:**

```json
{
  "success": true,
  "message": "Magic link sent successfully. Please check your email."
}
```

**How It Works:**

1. Validates email format
2. Validates client ID and finds app
3. Validates redirect URI is in app's allowlist
4. Generates secure random token (32 bytes, hex)
5. Sets token expiration (10 minutes)
6. Creates token document in database
7. Sends magic link email with token
8. Returns success response

---

### `POST /api/validate-magic-link`

Verify magic link token and complete authentication.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `token` | string | Yes | The magic link token from URL |

**Example Request:**

```javascript
// After user clicks the magic link, extract token from URL
const token = new URLSearchParams(window.location.search).get('token');

const response = await fetch('https://api.voult.dev/api/validate-magic-link', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret'
  },
  body: JSON.stringify({ token })
});
```

**Response:**

```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "accessToken": "jwt_access_token",
    "refreshToken": "refresh_token",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "fullName": "John Doe",
      "isEmailVerified": true
    }
  }
}
```

---

## Session Management

### `POST /api/auth/logout`

Log out the current user and revoke all refresh tokens.

**Headers:**

Requires authentication (valid JWT access token in `Authorization: Bearer` header).

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/logout', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret',
    'x-client-token': 'user_access_token'
  }
});
```

**Response:**

```json
{
  "message": "Logged out successfully"
}
```

**How It Works:**

1. Validates client credentials
2. Validates end user JWT
3. Revokes all refresh tokens for user/app
4. Increments user's tokenVersion (invalidates all access tokens)
5. Returns success message

---

### `GET /api/sessions`

Get all active sessions for the current user.

**Headers:**

Requires authentication.

**Response:**

```json
{
  "sessions": [
    {
      "id": "session_id",
      "ipAddress": "127.0.0.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastUsedAt": "2024-01-01T12:00:00.000Z",
      "expiresAt": "2024-01-31T00:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/sessions/revoke/:sessionId`

Revoke a specific session.

**Headers:**

Requires authentication.

**Response:**

```json
{
  "message": "Session revoked successfully"
}
```

---

### `POST /api/sessions/refresh`

Refresh an expired access token using a refresh token.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `refreshToken` | string | Yes | Valid refresh token |

**Response:**

```json
{
  "accessToken": "new_jwt_access_token",
  "refreshToken": "new_refresh_token"
}
```

**How It Works:**

1. Validates refresh token exists and not revoked
2. Detects token reuse (security measure)
3. Checks token expiration
4. Issues new access and refresh tokens (rotation)
5. Revokes old refresh token

---

## OAuth Providers

### Google OAuth

#### `POST /api/auth/google/register`

Register a new user with Google OAuth.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `idToken` | string | Yes (or accessToken) | Google ID token |
| `accessToken` | string | Yes (or idToken) | Google access token |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/google/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret'
  },
  body: JSON.stringify({
    idToken: googleIdToken
  })
});
```

**Response:**

```json
{
  "message": "Google registration successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

---

#### `POST /api/auth/google/login`

Login with existing Google account.

**Request Body:**

Same as register.

**Response:**

```json
{
  "message": "Google login successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

**How It Works:**

1. Validates client and Google OAuth configuration
2. Verifies Google ID token or fetches user info via access token
3. Checks email is verified in Google
4. Finds user by email
5. Links Google ID if not already linked
6. Issues tokens
7. Returns user data

---

### GitHub OAuth

#### `POST /api/auth/github/register`

Register a new user with GitHub OAuth.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `code` | string | Yes | GitHub authorization code |
| `redirect_uri` | string | No | Must match configured redirect URI |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/github/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id',
    'Authorization': 'Bearer your-client-secret'
  },
  body: JSON.stringify({
    code: githubAuthCode,
    redirect_uri: 'https://yourapp.com/auth/github/callback'
  })
});
```

**Response:**

```json
{
  "message": "GitHub registration successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

---

#### `POST /api/auth/github/login`

Login with existing GitHub account.

**Request Body:** Same as register.

**How It Works:**

1. Exchanges code for access token via GitHub OAuth
2. Fetches user profile and primary verified email
3. Finds user by email
4. Links GitHub ID if not already linked
5. Issues tokens

---

### Facebook OAuth

#### `POST /api/auth/facebook/register`

Register with Facebook OAuth.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `accessToken` | string | Yes | Facebook access token |

**Response:**

```json
{
  "message": "Facebook registration successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

**Note:** Facebook allows accounts without email. If email exists, checks for duplicates. If same Facebook account, treats as login.

---

#### `POST /api/auth/facebook/login`

Login with existing Facebook account.

**Request Body:** Same as register.

---

### LinkedIn OAuth

#### `POST /api/auth/linkedin/register`

Register with LinkedIn OAuth.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `code` | string | Yes | LinkedIn authorization code |

**Response:**

```json
{
  "message": "LinkedIn registration successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

---

#### `POST /api/auth/linkedin/login`

Login with existing LinkedIn account.

**Request Body:** Same as register.

---

### Microsoft OAuth

#### `POST /api/auth/microsoft/register`

Register with Microsoft OAuth.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `code` | string | Yes | Microsoft authorization code |

**Response:**

```json
{
  "message": "Microsoft registration successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe"
  }
}
```

---

#### `POST /api/auth/microsoft/login`

Login with existing Microsoft account.

**Request Body:** Same as register.

---

### Apple OAuth

#### `POST /api/auth/apple/register`

Register with Apple OAuth (mounted at root `/api`, full path: `/api/auth/apple/register`).

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `code` | string | Yes | Apple authorization code |
| `idToken` | string | Yes | Apple ID token |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/apple/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id'
  },
  body: JSON.stringify({
    code: appleAuthCode,
    idToken: appleIdToken
  })
});
```

**Response:**

```json
{
  "message": "Apple registration successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

---

#### `POST /api/auth/apple/login`

Login with existing Apple account (full path: `/api/auth/apple/login`).

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `idToken` | string | Yes | Apple ID token (only idToken needed for login) |

**Example Request:**

```javascript
const response = await fetch('https://api.voult.dev/api/auth/apple/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Id': 'app_your-client-id'
  },
  body: JSON.stringify({
    idToken: appleIdToken
  })
});
```

**Response:**

```json
{
  "message": "Apple login successful",
  "accessToken": "jwt_access_token",
  "refreshToken": "refresh_token",
  "user": {
    "id": "user_id",
    "email": "user@example.com"
  }
}
```

**Implementation Notes:**

- Requires Apple OAuth configuration with: `clientId`, `teamId`, `keyId`, `privateKey`
- Apple requires JWT client secret for token exchange
- Only idToken is required for login (code not needed)
- Uses ES256 algorithm for signing

**Implementation Notes:**

- Requires Apple OAuth configuration with: `clientId`, `teamId`, `keyId`, `privateKey`
- Apple requires JWT client secret for token exchange
- Uses ES256 algorithm for signing

---

## User Management

### `GET /api/user/me`

Get current authenticated user profile.

**Headers:**

Requires authentication.

**Response:**

```json
{
  "id": "user_id",
  "email": "user@example.com",
  "app": "app_id",
  "name": "John Doe",
  "isEmailVerified": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T12:00:00.000Z",
  "failedLoginAttempts": 0,
  "isLocked": false,
  "lastLoginAt": "2024-01-01T12:00:00.000Z"
}
```

---

### `PATCH /api/user/me`

Update user profile.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `fullName` | string | Yes | New full name (must be different from current) |

**Response:**

```json
{
  "message": "Profile updated successfully",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "fullName": "John Doe",
    "authProvider": "local",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

---

### `POST /api/user/disable`

Disable (soft delete) the current user account.

**Response:**

```json
{
  "success": true,
  "message": "Account disabled successfully"
}
```

---

### `POST /api/user/reenable`

Re-enable a disabled user account.

**Response:**

```json
{
  "success": true,
  "message": "Account re-enabled successfully. Please log in again."
}
```

---

### `GET /api/user/verify-email`

Verify user email via token from email link.

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `token` | string | Yes | Email verification token |
| `appId` | string | Yes | Application ID |

**Response:**

```json
{
  "message": "Email verified successfully"
}
```

---

## OAuth Account Linking

### `POST /api/oauth/:provider/link`

Start OAuth linking flow for an authenticated user.

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `provider` | string | OAuth provider (`google`, `github`, `facebook`, `linkedin`, `apple`, `microsoft`) |

**Response:**

```json
{
  "redirectUrl": "https://provider.com/oauth/authorize?..."
}
```

**How It Works:**

1. Validates user is authenticated
2. Validates provider is enabled for app
3. Generates OAuth authorization URL with `intent=link` in state
4. Returns redirect URL for frontend to redirect user

---

### `GET /api/me/oauth-accounts`

Get all linked OAuth providers for current user.

**Response:**

```json
{
  "providers": [
    {
      "provider": "google",
      "avatar": "https://...",
      "name": "John Doe",
      "email": "user@example.com",
      "linkedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### `DELETE /api/me/oauth-accounts/:provider`

Unlink an OAuth provider from user account.

**Path Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `provider` | string | OAuth provider to unlink |

**Response:**

```json
{
  "success": true,
  "message": "Provider unlinked successfully"
}
```

**Note:** Cannot unlink if it would leave user without any authentication method (password or at least one OAuth provider).

---

### `POST /api/me/set-password`

Set password for social-only accounts.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `password` | string | Yes | New password |

**Response:**

```json
{
  "success": true
}
```

---

## Password Reset

### `POST /api/user/forgot-password`

Send password reset email.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `email` | string | Yes | User's email |

**Response:**

```json
{
  "message": "If that email exists, a reset link has been sent"
}
```

**Note:** Always returns same message to prevent email enumeration attacks.

---

### `POST /api/user/reset-password`

Reset password with token.

**Query Parameters:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `token` | string | Yes | Reset token from email |
| `appId` | string | Yes | Application ID |

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `password` | string | Yes | New password |

**Response:**

```json
{
  "message": "Password reset successfully"
}
```

---

## Provider Visibility

### `GET /api/provider-visibility/:clientId`

Get which OAuth providers are enabled for an app.

**Response:**

```json
{
  "providers": {
    "google": true,
    "github": true,
    "facebook": false,
    "linkedin": true,
    "apple": true,
    "microsoft": false
  }
}
```

**Use Case:** Show only enabled providers on login/register UI.

---

## OAuth Flow (Generic)

### `POST /api/:provider/authorize`

Generate OAuth authorization URL for any provider.

**Request Body:**

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `intent` | string | Yes | `register`, `login`, or `link` |
| `redirectUri` | string | Yes | Callback URL |
| `appId` | string | Yes | Application ID (header or body) |
| `userId` | string | Required for `link` intent |

**Response:**

```json
{
  "authUrl": "https://provider.com/oauth/authorize?...",
  "provider": "google",
  "intent": "login",
  "expiresInSeconds": 600
}
```

### `GET /api/:provider/callback`

Handle OAuth callback (automatically called by OAuth provider).

**Query Parameters:**

| Parameter | Type | Description |
| --------- | ---- | ----------- |
| `code` | string | Authorization code |
| `state` | string | Base64url-encoded state object |

---

## Error Classes

### Available Error Codes

| Error Code | HTTP Status | Description |
| ---------- | ----------- | ----------- |
| `VALIDATION_ERROR` | 400 | Invalid input (email, password, etc.) |
| `INVALID_USERNAME` | 400 | Username format invalid |
| `WEAK_PASSWORD` | 400 | Password doesn't meet requirements |
| `ACCOUNT_LOCKED` | 423 | Too many failed login attempts |
| `INVALID_CREDENTIALS` | 401 | Invalid login credentials |
| `EMAIL_NOT_VERIFIED` | 403 | Email not verified |
| `ACCOUNT_DISABLED` | 403 | Account is disabled |
| `USER_EXISTS` | 409 | User already exists |
| `USERNAME_TAKEN` | 409 | Username already taken |
| `INVALID_CLIENT` | 401 | Invalid or inactive app |
| `CLIENT_ID_REQUIRED` | 401 | Missing X-Client-Id header |
| `CLIENT_SECRET_REQUIRED` | 401 | Missing client secret |
| `UNAUTHORIZED` | 401 | Authentication required |
| `TOKEN_APP_MISMATCH` | 403 | Token doesn't belong to this app |
| `INVALID_REFRESH_TOKEN` | 401 | Invalid refresh token |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expired |
| `REFRESH_TOKEN_REUSE_DETECTED` | 401 | Session compromised |
| `GOOGLE_NOT_CONFIGURED` | 400 | Google OAuth not enabled |
| `GITHUB_NOT_CONFIGURED` | 400 | GitHub OAuth not configured |
| `FACEBOOK_NOT_ENABLED` | 400 | Facebook OAuth not enabled |
| `LINKEDIN_NOT_ENABLED` | 400 | LinkedIn OAuth not enabled |
| `APPLE_NOT_ENABLED` | 400 | Apple OAuth not enabled |
| `MICROSOFT_NOT_ENABLED` | 400 | Microsoft OAuth not enabled |

---

## Implementation Guide

### Quick Start

1. **Create an App in Voult Dashboard**
   - Get your `clientId` and `clientSecret`
   - Configure allowed callback URLs
   - Enable desired OAuth providers

2. **Configure OAuth Providers**
   - **Google**: Get `clientId` and `clientSecret` from Google Cloud Console
   - **GitHub**: Get `clientId` and `clientSecret` from GitHub App settings
   - **Facebook**: Get `appId` and `appSecret` from Facebook Developer Console
   - **LinkedIn**: Get `clientId` and `clientSecret` from LinkedIn Developer Portal
   - **Microsoft**: Get `clientId` and `clientSecret` from Azure Portal
   - **Apple**: Get `clientId`, `teamId`, `keyId`, and `privateKey` from Apple Developer

3. **Password Requirements**

```javascript
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// Validates: min 8 chars, uppercase, lowercase, number, special char (@$!%*?&")
function isValidPassword(password) {
  return PASSWORD_REGEX.test(password);
}
```

4. **Username Requirements**

```
Length: 3-30 characters
Allowed: alphanumeric (a-z, A-Z, 0-9) and underscores (_)
Case: automatically converted to lowercase
```

---

### OAuth Implementation Patterns

#### Frontend OAuth Flow

```javascript
// Step 1: Get provider visibility
const getProviders = async (clientId) => {
  const res = await fetch(`https://api.voult.dev/api/provider-visibility/${clientId}`);
  return res.json(); // { providers: { google: true, ... } }
};

// Step 2: Generate auth URL
const getAuthUrl = async (provider, intent, redirectUri) => {
  const res = await fetch(`https://api.voult.dev/api/${provider}/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent, redirectUri, appId: clientId })
  });
  return res.json(); // { authUrl: '...' }
};

// Step 3: Redirect user to authUrl
// Step 4: Handle callback on your redirectUri - API automatically handles tokens
```

#### Direct OAuth (Google/Facebook/Apple)

For providers like Google, Facebook, and Apple that support direct token validation:

```javascript
// Google example
const googleLogin = async (idToken, clientId, clientSecret) => {
  const res = await fetch('https://api.voult.dev/api/auth/google/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Id': clientId,
      'Authorization': `Bearer ${clientSecret}`
    },
    body: JSON.stringify({ idToken })
  });
  return res.json();
};
```

---

### Token Storage

**Access Token (JWT):**
- Short-lived (15 min in production, 7 days in development)
- Store in memory or httpOnly cookie
- Include in `Authorization: Bearer` header for authenticated requests

**Refresh Token:**
- Long-lived (30 days)
- Store in httpOnly, secure cookie
- Use `/api/sessions/refresh` to get new tokens

---

### Security Considerations

1. **Rate Limiting:** All auth endpoints have rate limiting (`authLimiter`)
2. **Account Lockout:** Accounts lock after 5 failed login attempts for 15 minutes
3. **CSRF Protection:** Enabled on all POST endpoints (disabled in current middleware)
4. **Token Rotation:** Refresh tokens are rotated on each use
5. **Reuse Detection:** Reused refresh tokens trigger mass token revocation
6. **Email Verification:** Required for password-based accounts before login
7. **Callback URL Validation:** Redirect URIs must be in app's allowlist

---

### Environment Variables Required

```bash
# Required
ENDUSER_JWT_SECRET=<32+ char secret>
BASE_URL=https://your-domain.com
SESSION_SECRET=<session secret>
REFRESH_TOKEN_SECRET=<refresh token secret>
SECRET=<production session secret>

# OAuth (optional, enable as needed)
GOOGLE_CLIENT_ID=<google client id>
GOOGLE_CLIENT_SECRET=<google client secret>
```

---

## API Endpoints Summary

| Endpoint | Method | Auth Required | Description |
| -------- | ------ | ------------- | ----------- |
| `/api/auth/register` | POST | Client Auth | Register with email/password |
| `/api/auth/username-register` | POST | Client Auth | Register with username/password |
| `/api/auth/email-login` | POST | Client Auth | Login with email/password |
| `/api/auth/username-login` | POST | Client Auth | Login with username/password |
| `/api/auth/logout` | POST | End User JWT | Logout current user |
| `/api/send-magic-link` | POST | None | Send passwordless magic link |
| `/api/validate-magic-link` | POST | Client Auth | Validate magic link token |
| `/api/auth/google/register` | POST | Client Auth | Google OAuth registration |
| `/api/auth/google/login` | POST | Client Auth | Google OAuth login |
| `/api/auth/github/register` | POST | Client Auth | GitHub OAuth registration |
| `/api/auth/github/login` | POST | Client Auth | GitHub OAuth login |
| `/api/auth/facebook/register` | POST | Client Auth | Facebook OAuth registration |
| `/api/auth/facebook/login` | POST | Client Auth | Facebook OAuth login |
| `/api/auth/linkedin/register` | POST | Client Auth | LinkedIn OAuth registration |
| `/api/auth/linkedin/login` | POST | Client Auth | LinkedIn OAuth login |
| `/api/auth/microsoft/register` | POST | Client Auth | Microsoft OAuth registration |
| `/api/auth/microsoft/login` | POST | Client Auth | Microsoft OAuth login |
| `/api/auth/apple/register` | POST | Client Auth | Apple OAuth registration |
| `/api/auth/apple/login` | POST | Client Auth | Apple OAuth login |
| `/api/user/me` | GET | End User JWT | Get current user profile |
| `/api/user/me` | PATCH | End User JWT | Update user profile |
| `/api/user/verify-email` | GET | None | Verify email with token |
| `/api/user/forgot-password` | POST | Client Auth | Send reset email |
| `/api/user/reset-password` | POST | Client Auth | Reset password |
| `/api/user/disable` | POST | End User JWT | Disable account |
| `/api/user/reenable` | POST | End User JWT | Re-enable account |
| `/api/sessions` | GET | End User JWT | List sessions |
| `/api/sessions/revoke/:id` | GET | End User JWT | Revoke session |
| `/api/sessions/refresh` | POST | None | Refresh access token |
| `/api/provider-visibility/:clientId` | GET | None | Get enabled providers |
| `/api/:provider/authorize` | POST | None | Generate OAuth URL |
| `/api/:provider/callback` | GET | None | OAuth callback |
| `/api/oauth/:provider/link` | POST | End User JWT | Link OAuth provider |
| `/api/me/oauth-accounts` | GET | End User JWT | Get linked providers |
| `/api/me/oauth-accounts/:provider` | DELETE | End User JWT | Unlink provider |
| `/api/me/set-password` | POST | End User JWT | Set password for social account |

---

## Middleware Overview

| Middleware | Purpose |
| ---------- | ------- |
| `verifyClient` | Validates X-Client-Id and Authorization headers |
| `verifyClientIdOnly` | Validates only X-Client-Id (for OAuth routes) |
| `requireEndUserAuth` | Requires valid end user JWT |
| `requireActiveEndUser` | Requires user account to be active |
| `validateCallbackUrl` | Validates redirectUri against app's allowlist |
| `apiLimiter` | Rate limiting for all API routes |
| `authLimiter` | Stricter rate limiting for auth routes |
| `csrfProtection` | CSRF token validation (currently disabled) |
| `verifyEndUserJWT` | Global JWT verification middleware |