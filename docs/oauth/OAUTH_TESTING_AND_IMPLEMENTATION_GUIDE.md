# OAuth Testing and Implementation Guide for Voult Server

This guide provides comprehensive instructions for testing and implementing all OAuth providers supported by Voult server.

## Table of Contents

1. [Overview](#overview)
2. [Supported OAuth Providers](#supported-oauth-providers)
3. [Prerequisites](#prerequisites)
4. [Setting Up OAuth Providers](#setting-up-oauth-providers)
5. [Testing OAuth Implementation](#testing-oauth-implementation)
6. [API Reference](#api-reference)
7. [Frontend Integration Examples](#frontend-integration-examples)
8. [Troubleshooting](#troubleshooting)
9. [Security Best Practices](#security-best-practices)

## Overview

Voult server supports OAuth 2.0 authentication for multiple providers:
- Google
- GitHub
- Facebook
- LinkedIn
- Microsoft
- Apple

The server implements both **authorization code flow** (recommended) and **ID token flow** for Google OAuth.

## Supported OAuth Providers

| Provider | Flow Type | Registration Required | Notes |
|----------|-----------|----------------------|-------|
| Google | Code + ID Token | ✅ | Both flows supported |
| GitHub | Code | ✅ | Authorization code flow only |
| Facebook | Code | ✅ | Authorization code flow only |
| LinkedIn | Code | ✅ | Authorization code flow only |
| Microsoft | Code | ✅ | Authorization code flow only |
| Apple | Code | ✅ | Authorization code flow only |

## Prerequisites

### 1. Voult Server Setup
```bash
# Ensure Voult server is running
npm start
# Server should be accessible at http://localhost:3000
```

### 2. Database Setup
Ensure MongoDB is running and the Voult database is properly configured.

### 3. Test App Registration
Create a test app in the Voult dashboard or via API:
```bash
# Example API call to create a test app
curl -X POST http://localhost:3000/api/app \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test OAuth App",
    "description": "App for testing OAuth flows",
    "domain": "localhost:3000"
  }'
```

## Setting Up OAuth Providers

### 1. Google OAuth Setup

#### Step 1: Create Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Navigate to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen
6. Create credentials:
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/oauth/google/callback`

#### Step 2: Configure in Voult
```bash
# Update your app with Google OAuth credentials
curl -X PUT http://localhost:3000/api/app/{app_id}/oauth/google \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-google-client-id",
    "clientSecret": "your-google-client-secret",
    "redirectUri": "http://localhost:3000/api/oauth/google/callback",
    "enabled": true
  }'
```

### 2. GitHub OAuth Setup

#### Step 1: Create GitHub OAuth App
1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Configure:
   - Application name: Your app name
   - Homepage URL: `http://localhost:3000`
   - Authorization callback URL: `http://localhost:3000/api/oauth/github/callback`

#### Step 2: Configure in Voult
```bash
curl -X PUT http://localhost:3000/api/app/{app_id}/oauth/github \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-github-client-id",
    "clientSecret": "your-github-client-secret",
    "redirectUri": "http://localhost:3000/api/oauth/github/callback",
    "enabled": true
  }'
```

### 3. Facebook OAuth Setup

#### Step 1: Create Facebook App
1. Go to [Facebook Developer Console](https://developers.facebook.com/)
2. Create a new app
3. Add "Facebook Login" product
4. Configure OAuth redirect URIs: `http://localhost:3000/api/oauth/facebook/callback`

#### Step 2: Configure in Voult
```bash
curl -X PUT http://localhost:3000/api/app/{app_id}/oauth/facebook \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "your-facebook-app-id",
    "appSecret": "your-facebook-app-secret",
    "redirectUri": "http://localhost:3000/api/oauth/facebook/callback",
    "enabled": true
  }'
```

### 4. LinkedIn OAuth Setup

#### Step 1: Create LinkedIn App
1. Go to [LinkedIn Developer Console](https://www.linkedin.com/developers/)
2. Create a new app
3. Configure OAuth 2.0 settings:
   - Authorized redirect URLs: `http://localhost:3000/api/oauth/linkedin/callback`

#### Step 2: Configure in Voult
```bash
curl -X PUT http://localhost:3000/api/app/{app_id}/oauth/linkedin \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-linkedin-client-id",
    "clientSecret": "your-linkedin-client-secret",
    "redirectUri": "http://localhost:3000/api/oauth/linkedin/callback",
    "enabled": true
  }'
```

### 5. Microsoft OAuth Setup

#### Step 1: Create Azure AD App
1. Go to [Azure Portal](https://portal.azure.com/)
2. Azure Active Directory → App registrations → New registration
3. Configure redirect URI: `http://localhost:3000/api/oauth/microsoft/callback`

#### Step 2: Configure in Voult
```bash
curl -X PUT http://localhost:3000/api/app/{app_id}/oauth/microsoft \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-microsoft-client-id",
    "clientSecret": "your-microsoft-client-secret",
    "tenantId": "your-tenant-id",
    "redirectUri": "http://localhost:3000/api/oauth/microsoft/callback",
    "enabled": true
  }'
```

### 6. Apple OAuth Setup

#### Step 1: Create Apple Developer App
1. Go to [Apple Developer Console](https://developer.apple.com/)
2. Create a new app identifier
3. Enable "Sign in with Apple"
4. Create a private key for authentication

#### Step 2: Configure in Voult
```bash
curl -X PUT http://localhost:3000/api/app/{app_id}/oauth/apple \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your-apple-client-id",
    "teamId": "your-apple-team-id",
    "keyId": "your-apple-key-id",
    "privateKey": "your-apple-private-key",
    "redirectUri": "http://localhost:3000/api/oauth/apple/callback",
    "enabled": true
  }'
```

## Testing OAuth Implementation

### 1. Test Authorization URL Generation

```bash
# Test Google OAuth URL generation
curl -X POST http://localhost:3000/api/oauth/google/authorize \
  -H "Content-Type: application/json" \
  -H "X-App-ID: your-app-id" \
  -d '{
    "intent": "register",
    "redirectUri": "http://localhost:3000/oauth-callback"
  }'
```

Expected response:
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "provider": "google",
  "intent": "register",
  "expiresInSeconds": 600
}
```

### 2. Test OAuth Callback Flow

#### Manual Testing
1. Get the auth URL from the authorize endpoint
2. Open it in a browser
3. Complete the OAuth flow
4. Observe the callback to your redirect URI

#### Automated Testing with Postman
Create a Postman collection with these requests:

```javascript
// 1. Generate Auth URL
pm.test("Generate Auth URL", function () {
    pm.expect(pm.response.code).to.eql(200);
    pm.expect(pm.response.json()).to.have.property('authUrl');
});

// 2. Handle Callback (simulate)
pm.test("Handle OAuth Callback", function () {
    // This would be called by the OAuth provider
    // Test with a mock code parameter
});
```

### 3. Test Different Intents

#### Registration Flow
```bash
# Generate auth URL for registration
curl -X POST http://localhost:3000/api/oauth/google/authorize \
  -H "Content-Type: application/json" \
  -H "X-App-ID: your-app-id" \
  -d '{
    "intent": "register",
    "redirectUri": "http://localhost:3000/oauth-callback"
  }'
```

#### Login Flow
```bash
# Generate auth URL for login
curl -X POST http://localhost:3000/api/oauth/google/authorize \
  -H "Content-Type: application/json" \
  -H "X-App-ID: your-app-id" \
  -d '{
    "intent": "login",
    "redirectUri": "http://localhost:3000/oauth-callback"
  }'
```

#### Account Linking Flow
```bash
# Generate auth URL for account linking
curl -X POST http://localhost:3000/api/oauth/google/authorize \
  -H "Content-Type: application/json" \
  -H "X-App-ID: your-app-id" \
  -d '{
    "intent": "link",
    "userId": "user-id-to-link",
    "redirectUri": "http://localhost:3000/oauth-callback"
  }'
```

### 4. Test Error Scenarios

#### Missing Parameters
```bash
# Test missing intent
curl -X POST http://localhost:3000/api/oauth/google/authorize \
  -H "Content-Type: application/json" \
  -H "X-App-ID: your-app-id" \
  -d '{
    "redirectUri": "http://localhost:3000/oauth-callback"
  }'
```

Expected response:
```json
{
  "error": "MISSING_PARAMETERS",
  "message": "intent and redirectUri are required"
}
```

#### Invalid Provider
```bash
# Test invalid provider
curl -X POST http://localhost:3000/api/oauth/invalid/authorize \
  -H "Content-Type: application/json" \
  -H "X-App-ID: your-app-id" \
  -d '{
    "intent": "register",
    "redirectUri": "http://localhost:3000/oauth-callback"
  }'
```

Expected response:
```json
{
  "error": "INVALID_PROVIDER",
  "message": "Unsupported OAuth provider"
}
```

## API Reference

### OAuth Endpoints

#### POST /api/oauth/:provider/authorize
Generate OAuth authorization URL.

**Parameters:**
- `provider`: OAuth provider (google, github, facebook, linkedin, microsoft, apple)
- `intent`: Flow type (register, login, link)
- `redirectUri`: Where to redirect after OAuth completion
- `userId`: Required for link intent

**Example Request:**
```bash
POST /api/oauth/google/authorize
Content-Type: application/json
X-App-ID: your-app-id

{
  "intent": "register",
  "redirectUri": "http://localhost:3000/oauth-callback"
}
```

**Example Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "provider": "google",
  "intent": "register",
  "expiresInSeconds": 600
}
```

#### GET /api/oauth/:provider/callback
Handle OAuth callback and exchange code for tokens.

**Parameters:**
- `code`: Authorization code from OAuth provider
- `state`: State parameter (contains intent and app info)

**Example Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

**Example Response (Link Success):**
```json
{
  "message": "ACCOUNT_LINKED_SUCCESSFULLY"
}
```

### Error Responses

| Error Code | Description | HTTP Status |
|------------|-------------|-------------|
| `MISSING_PARAMETERS` | Required parameters missing | 400 |
| `INVALID_INTENT` | Invalid intent value | 400 |
| `MISSING_APP_ID` | App ID not provided | 400 |
| `MISSING_USER_ID` | User ID required for link | 400 |
| `INVALID_PROVIDER` | Unsupported OAuth provider | 400 |
| `PROVIDER_NOT_ENABLED` | Provider disabled for app | 403 |
| `INVALID_OAUTH_CALLBACK` | Missing code or state | 400 |
| `APP_NOT_ACTIVE` | App is not active | 404 |
| `PROVIDER_DISABLED_FOR_THIS_APP` | Provider disabled | 403 |
| `PROVIDER_ID_NOT_FOUND` | No provider ID in profile | 400 |
| `INVALID_LINK_STATE` | Invalid link state | 400 |
| `PROVIDER_ALREADY_LINKED_TO_ANOTHER_USER` | Account already linked | 409 |
| `ACCOUNT_NOT_REGISTERED` | No account found | 404 |
| `ACCOUNT_ALREADY_EXISTS` | Account already exists | 409 |
| `EMAIL_REQUIRED_FOR_REGISTRATION` | Email required | 400 |
| `INVALID_INTENT` | Invalid intent in callback | 400 |
| `OAUTH_CALLBACK_FAILED` | Internal server error | 500 |

## Frontend Integration Examples

### 1. React Integration

```jsx
import React, { useState } from 'react';

function OAuthLogin({ provider, intent, onAuthSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleOAuthLogin = async () => {
    setLoading(true);
    
    try {
      // Step 1: Get authorization URL
      const response = await fetch(`http://localhost:3000/api/oauth/${provider}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-ID': 'your-app-id'
        },
        body: JSON.stringify({
          intent,
          redirectUri: `${window.location.origin}/oauth-callback`
        })
      });

      const { authUrl } = await response.json();
      
      // Step 2: Redirect to OAuth provider
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('OAuth error:', error);
      setLoading(false);
    }
  };

  return (
    <button onClick={handleOAuthLogin} disabled={loading}>
      {loading ? 'Loading...' : `Sign in with ${provider}`}
    </button>
  );
}

// OAuth Callback Handler Component
function OAuthCallback() {
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && state) {
        try {
          // The Voult server handles the callback directly
          // This component is just for showing loading state
          setLoading(false);
          
          // Redirect to dashboard or wherever appropriate
          window.location.href = '/dashboard';
          
        } catch (error) {
          console.error('Callback error:', error);
          setLoading(false);
        }
      }
    };

    handleCallback();
  }, []);

  return (
    <div>
      {loading ? <p>Processing OAuth callback...</p> : <p>Authentication complete!</p>}
    </div>
  );
}
```

### 2. Vanilla JavaScript Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>OAuth Test</title>
</head>
<body>
  <h1>OAuth Test App</h1>
  
  <div>
    <h2>Google OAuth</h2>
    <button onclick="startOAuth('google', 'register')">Register with Google</button>
    <button onclick="startOAuth('google', 'login')">Login with Google</button>
  </div>

  <div>
    <h2>GitHub OAuth</h2>
    <button onclick="startOAuth('github', 'register')">Register with GitHub</button>
    <button onclick="startOAuth('github', 'login')">Login with GitHub</button>
  </div>

  <script>
    async function startOAuth(provider, intent) {
      try {
        const response = await fetch(`http://localhost:3000/api/oauth/${provider}/authorize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-ID': 'your-app-id'
          },
          body: JSON.stringify({
            intent,
            redirectUri: window.location.origin + '/oauth-callback'
          })
        });

        const { authUrl } = await response.json();
        
        // Redirect to OAuth provider
        window.location.href = authUrl;
        
      } catch (error) {
        console.error('OAuth error:', error);
        alert('OAuth failed. Check console for details.');
      }
    }

    // Handle OAuth callback
    if (window.location.pathname === '/oauth-callback') {
      handleOAuthCallback();
    }

    function handleOAuthCallback() {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (code) {
        // The Voult server handles the callback directly
        // Just show a success message
        document.body.innerHTML = '<h1>Authentication successful!</h1><p>You will be redirected shortly...</p>';
        
        // Redirect after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    }
  </script>
</body>
</html>
```

### 3. Mobile App Integration (React Native)

```javascript
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

class OAuthManager {
  constructor() {
    this.voultServer = 'http://localhost:3000';
    this.appId = 'your-app-id';
  }

  async startGoogleOAuth(intent) {
    try {
      // Step 1: Get authorization URL from Voult
      const response = await fetch(`${this.voultServer}/api/oauth/google/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-ID': this.appId
        },
        body: JSON.stringify({
          intent,
          redirectUri: 'your-app://oauth-callback'
        })
      });

      const { authUrl } = await response.json();
      
      // Step 2: Open the auth URL in a web view
      // This would typically use a library like react-native-inappbrowser-reborn
      await InAppBrowser.open(authUrl, {
        // Browser options
      });
      
    } catch (error) {
      console.error('OAuth error:', error);
    }
  }

  async handleOAuthCallback(url) {
    // Parse the callback URL to extract code and state
    const urlParams = new URLSearchParams(url.split('?')[1]);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code) {
      // The Voult server would handle this callback
      // In a mobile app, you might need to handle it differently
      console.log('OAuth successful:', { code, state });
    }
  }
}
```

## Troubleshooting

### Common Issues

#### 1. Redirect URI Mismatch
**Problem**: OAuth provider returns "redirect_uri_mismatch" error.
**Solution**: Ensure the redirect URI in your OAuth provider settings exactly matches the one configured in Voult.

#### 2. Invalid Client Credentials
**Problem**: "invalid_client" or "unauthorized_client" errors.
**Solution**: Verify that client ID and client secret are correctly configured in Voult.

#### 3. State Parameter Issues
**Problem**: "invalid_state" or "state_mismatch" errors.
**Solution**: Ensure the state parameter is properly encoded and decoded.

#### 4. CORS Issues
**Problem**: Frontend requests fail with CORS errors.
**Solution**: Configure CORS properly in Voult server settings.

#### 5. Database Connection Issues
**Problem**: OAuth fails with database errors.
**Solution**: Ensure MongoDB is running and properly configured.

### Debugging OAuth Flows

#### Enable Debug Logging
Add debug logging to your Voult server:
```javascript
// In your server setup
const logger = require('./utils/logger');

// Add logging to OAuth controller
exports.handleCallback = async (req, res) => {
  logger.info('OAuth callback received', {
    provider: req.params.provider,
    query: req.query
  });
  
  // ... rest of the function
};
```

#### Test with Postman
Create Postman requests to test each step:
1. Generate auth URL
2. Simulate callback with mock data
3. Test error scenarios

#### Browser Developer Tools
Use browser dev tools to:
- Monitor network requests
- Check console for JavaScript errors
- Inspect cookies and local storage

### Provider-Specific Issues

#### Google OAuth
- Ensure Google+ API is enabled
- Check OAuth consent screen configuration
- Verify redirect URIs are properly configured

#### GitHub OAuth
- Ensure OAuth app is properly configured
- Check application name and callback URL
- Verify scopes are appropriate

#### Facebook OAuth
- Ensure Facebook Login product is added
- Check app review status for required permissions
- Verify redirect URIs in Facebook settings

#### LinkedIn OAuth
- Ensure OAuth 2.0 settings are configured
- Check if app is in development or production mode
- Verify redirect URIs are whitelisted

#### Microsoft OAuth
- Ensure Azure AD app is properly configured
- Check if required API permissions are granted
- Verify redirect URIs in Azure portal

#### Apple OAuth
- Ensure Sign in with Apple is enabled
- Verify private key is properly configured
- Check if app is properly configured in Apple Developer Console

## Security Best Practices

### 1. Secure OAuth Credentials
- Never commit OAuth credentials to version control
- Use environment variables for sensitive data
- Rotate OAuth credentials regularly

### 2. Validate Redirect URIs
- Always validate redirect URIs on the server side
- Use exact string matching for redirect URIs
- Never allow arbitrary redirect URIs

### 3. Handle State Parameter
- Always use state parameter for CSRF protection
- Validate state parameter on callback
- Use cryptographically secure random state values

### 4. Token Security
- Store refresh tokens securely (encrypted)
- Implement token rotation
- Set appropriate token expiration times

### 5. Error Handling
- Don't expose sensitive information in error messages
- Log errors for debugging but don't return them to clients
- Implement proper error handling for all OAuth flows

### 6. Rate Limiting
- Implement rate limiting on OAuth endpoints
- Monitor for suspicious OAuth activity
- Block repeated failed OAuth attempts

### 7. HTTPS in Production
- Always use HTTPS for OAuth in production
- Configure proper SSL/TLS certificates
- Ensure all OAuth endpoints use HTTPS

## Conclusion

This guide provides comprehensive instructions for implementing and testing OAuth authentication with Voult server. By following these steps, you can:

1. **Set up OAuth providers** correctly with proper credentials
2. **Test OAuth flows** thoroughly using various methods
3. **Integrate OAuth** into your frontend applications
4. **Troubleshoot common issues** effectively
5. **Implement security best practices** for OAuth

Remember to always test OAuth flows in a development environment before deploying to production, and to follow security best practices to protect user data and maintain the integrity of your authentication system.

For additional support or questions about OAuth implementation with Voult, refer to the official documentation or contact the Voult development team.