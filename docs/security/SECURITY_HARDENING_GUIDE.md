# Voult.dev Security Hardening Guide

## Production-Ready SaaS Authentication Platform

**Current Security Score: 6.5/10**  
**Target Security Score: 9+/10**  
**Implementation Timeline: 10 weeks**

---

## Executive Summary

This guide addresses critical security concerns in Voult.dev and provides production-ready solutions to achieve enterprise-grade security for SaaS applications. Each issue includes risk assessment, code examples, and implementation guidelines.

**Critical Issues (Fix Immediately):**

1. Session Cookie Security Configuration
2. Missing CSRF Protection
3. Incomplete XSS Prevention
4. Secret Key Management

**High Priority Issues:**
5. SQL/NoSQL Injection Hardening
6. Security Headers Implementation
7. Email Enumeration Prevention
8. Audit Logging System

---

## 🚨 CRITICAL ISSUES

### Issue #1: Session Cookie Security Configuration

**Risk Level:** 🔴 **CRITICAL**  
**Impact:** Session hijacking, man-in-the-middle attacks over HTTP

**Current Problem:**

```javascript
// config/session.js - INSECURE
const sessionConfig = {
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
       secure : false,  // ❌ Cookies sent over HTTP!
        httpOnly: true,
        sameSite: 'lax',
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        maxAge: 1000 * 60 * 60 * 24 * 7,
    }
};
```

**Solution:**

```javascript
// config/session.js - SECURE
const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
    secret: process.env.SECRET || process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,  // Changed: Don't create sessions unnecessarily
    name: 'voultSessionId',     // Changed: Use custom session name (security through obscurity)
    cookie: {
        secure: isProduction,   // ✅ Only HTTPS in production
        httpOnly: true,         // ✅ Prevents JS access
        sameSite: 'strict',     // ✅ Changed from 'lax' to 'strict'
        domain: isProduction ? '.voult.dev' : 'localhost',  // ✅ Restrict domain
        path: '/',
        maxAge: isProduction 
            ? 1000 * 60 * 60 * 1  // 1 hour in production
            : 1000 * 60 * 60 * 24 * 7  // 7 days in development
    }
};

// Validate required secrets
if (!process.env.SECRET && isProduction) {
    throw new Error('SESSION_SECRET or SECRET environment variable is required in production');
}

module.exports = sessionConfig;
```

**Implementation Checklist:**

- Update `config/session.js` with secure settings
- Set `NODE_ENV=production` in production
- Enable HTTPS on all production domains
- Test session behavior with secure flag
- Update `.env.example` with `SESSION_SECRET` requirement

---

### Issue #2: Missing CSRF Protection

**Risk Level:** 🔴 **CRITICAL**  
**Impact:** Cross-Site Request Forgery attacks, unauthorized state changes

**Solution:**

**Step 1: Install CSRF Middleware**

```bash
npm install csurf
```

**Step 2: Add CSRF Middleware Configuration**

Create `middleware/csrfProtection.js`:

```javascript
const csrf = require('csurf');
const session = require('express-session');

// CSRF protection middleware
const csrfProtection = csrf({ 
    cookie: false,  // Use session instead of cookies
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS']  // Only protect state-changing methods
});

// Middleware to generate and attach CSRF token to response locals
const generateCsrfToken = (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
};

module.exports = {
    csrfProtection,
    generateCsrfToken
};
```

**Step 3: Integrate into Main App**

Update `src/index.js`:

```javascript
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const { csrfProtection, generateCsrfToken } = require('../middleware/csrfProtection');
const sessionConfig = require('../config/session');

const app = express();

// Session middleware (must be before CSRF)
app.use(session(sessionConfig));

// CSRF protection for all routes
app.use(csrfProtection);

// Generate CSRF token for templates
app.use(generateCsrfToken);

// ... rest of middleware

app.use(express.json({
    verify: (req, res, buf, encoding) => {
        // For API endpoints that need CSRF
        if (req.path.startsWith('/api') && !req.path.startsWith('/api/public')) {
            if (!req.headers['x-csrf-token'] && !req.query._csrf) {
                throw new Error('CSRF token missing');
            }
        }
    }
}));

// ... rest of app setup

```

**Step 4: Update Web Forms**

For EJS templates (web forms):

what you add 

```ejs
<input type="hidden" name="_csrf" value="<%=csrfToken %>">
```

## Forms that need CSRF integration

- `views/partials/header.ejs`
  - `POST /logout`
- `views/auth/login.ejs`
  - `POST /login`
- `views/auth/register.ejs`
  - `POST /register`
- `views/forgottenPassword/forgot-password.ejs`
  - `POST /forgot-password`
- `views/forgottenPassword/reset-password.ejs`
  - `POST /reset-password/<%= token %>`
- `views/user/settings.ejs`
  - `POST /settings`
  - `POST /settings/email/request-change`
  - `POST /settings/unlink/google`
  - `POST /settings/unlink/github`
  - `POST /settings/password/set`
  - `POST /settings/password/change`
- `views/user/enterPassword.ejs`
  - `POST /delete-account` (two forms)
- `views/app/new.ejs`
  - `POST /app`
- `views/app/edit.ejs`
  - `POST /app/<%= app._id %>?_method=PUT`
  - `POST /app/<%= app._id %>?_method=DELETE`
- `views/app/manage.ejs`
  - `POST /app/<%= app._id %>/rotate-secret`
  - `POST /app/<%= app._id %>/toggle`
  - `POST /app/<%= app._id %>?_method=DELETE`
- `views/app/google/googleOAuthForm.ejs`
  - `POST /app/<%= app._id %>/google-oauth`
  - `POST /app/<%= app._id %>/update-google-oauth`
- `views/app/github/githubOauthForm.ejs`
  - `POST /app/<%= app._id %>/github-oauth`
  - `POST /app/<%= app._id %>/github-oauth` (update form)
- `views/app/github/githubOauthedit.ejs`
  - `POST /app/<%= app._id %>/google-oauth`
- `views/app/facebook/oauthForm.ejs`
  - `POST /app/<%= app._id %>/facebook-oauth`
  - `POST /app/<%= app._id %>/update-facebook-oauth`
- `views/app/apple/oauthForm.ejs`
  - `POST /app/<%= app._id %>/apple-oauth`
  - `POST /app/<%= app._id %>/update-apple-oauth`
- `views/app/microsoft/oauthForm.ejs`
  - `POST /app/<%= app._id %>/microsoft-oauth`
  - `POST /app/<%= app._id %>/update-microsoft-oauth`
- `views/app/linkedin/oauthForm.ejs`
  - `POST /app/<%= app._id %>/linkedin-oauth`
  - `POST /app/<%= app._id %>/update-linkedin-oauth`

**Step 5: API CSRF Protection**

For API endpoints, clients must send token in header:

```javascript
// controllers/api/auth.js - Add token validation
const { csrfProtection } = require('../../middleware/csrfProtection');

router.post('/api/auth/login', csrfProtection, async (req, res) => {
    // CSRF token automatically verified by middleware
    // Proceed with login logic
});
```

# Routes that need CSRF Protection.

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

Client-side (JavaScript):

```javascript
// Fetch CSRF token first
const response = await fetch('/auth/csrf-token', {
    method: 'GET',
    credentials: 'include'
});

const { token } = await response.json();

// Use token in subsequent API calls
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

**Testing CSRF Protection:**

```javascript
// tests/csrf.test.js
const request = require('supertest');
const app = require('../src/index');

describe('CSRF Protection', () => {
    test('Should reject POST without CSRF token', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@test.com', password: 'password' });
        
        expect(res.status).toBe(403);
        expect(res.body.message).toContain('CSRF');
    });
});
```

---

### Issue #3: Incomplete XSS Prevention

**Risk Level:** 🔴 **CRITICAL**  
**Impact:** Malicious script injection, account takeover, data theft

**Solution:**

**Step 1: Add Security Headers Middleware**

Install dependencies:

```bash
npm install helmet express-validator
```

Create `middleware/securityHeaders.js`:

```javascript
const helmet = require('helmet');

const securityHeadersMiddleware = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],  // Avoid unsafe-inline in production
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production'
        }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
        maxAge: 31536000,  // 1 year
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'no-referrer' },
    xssFilter: true
});

module.exports = securityHeadersMiddleware;
```

**Step 2: Create Input Sanitization Middleware**

Create `middleware/inputSanitization.js`:

```javascript
const { body, validationResult, query } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

// Sanitize function that removes dangerous content
const sanitize = (input) => {
    if (typeof input !== 'string') return input;
    
    // Remove HTML tags and dangerous attributes
    return DOMPurify.sanitize(input, { 
        ALLOWED_TAGS: [],  // No HTML tags allowed
        ALLOWED_ATTR: []
    }).trim();
};

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'VALIDATION_ERROR',
            messages: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Pre-defined validators for common fields
const validators = {
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),
    
    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
    
    username: body('username')
        .matches(/^[a-zA-Z0-9_]{3,30}$/)
        .withMessage('Username must be 3-30 characters, alphanumeric and underscores only'),
    
    fullName: body('fullName')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .escape()  // Escape HTML special characters
        .withMessage('Full name must not exceed 100 characters'),
    
    url: body('redirectUrl')
        .isURL()
        .withMessage('Invalid URL format')
};

module.exports = {
    sanitize,
    handleValidationErrors,
    validators
};
```

**Step 3: Install DOMPurify**

```bash
npm install isomorphic-dompurify
```

**Step 4: Update Authentication Controller**

Update `controllers/api/auth.js`

```javascript
const { ApiError } = require('../../utils/apiError');
const { validators, handleValidationErrors, sanitize } = require('../../middleware/inputSanitization');

// Add validation middleware to routes
router.post(
    '/register',
    [
        validators.email,
        validators.password,
        validators.username,
        validators.fullName,
        handleValidationErrors
    ],
    async (req, res) => {
        try {
            const { email, password, fullName, username } = req.body;
            const app = req.appClient;
            
            // Sanitize inputs
            const sanitizedEmail = sanitize(email.toLowerCase().trim());
            const sanitizedUsername = sanitize(username.toLowerCase().trim());
            const sanitizedFullName = sanitize(fullName);
            
            // Additional validation
            if (!sanitizedEmail || !password) {
                throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required');
            }
            
            // ... rest of registration logic
        } catch (err) {
            // Error handling
        }
    }
);
```

**Step 5: Update EJS Templates with Proper Escaping**

```ejs
<!-- views/dashboard.ejs -->
<!-- Use <%- %> for HTML output, <%= %> for escaped text -->

<!-- ✅ CORRECT - Escaped user input -->
<h1>Welcome, <%= user.fullName %></h1>
<p>Email: <%= user.email %></p>

<!-- ✅ CORRECT - Safe HTML injection -->
<%- renderedContent %>

<!-- ❌ AVOID - Unescaped user content (if used, sanitize first) -->
<!-- <%- user.bio %>  -->
```

**Step 6: Content Security Policy Headers**

Update `src/index.js`:

```javascript
const securityHeaders = require('../middleware/securityHeaders');

app.use(securityHeaders);
```

**Testing XSS Prevention:**

```javascript
// tests/xss.test.js
const request = require('supertest');
const app = require('../src/index');

describe('XSS Prevention', () => {
    test('Should sanitize email input', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: '<script>alert("xss")</script>@test.com',
                password: 'SecurePassword123!',
                username: 'testuser'
            });
        
        // Should either reject or sanitize
        expect(res.status).toBe(400);
    });
    
    test('Should escape user data in responses', async () => {
        const res = await request(app)
            .get('/api/user/me')
            .set('Authorization', `Bearer ${token}`);
        
        // Response should not contain unescaped HTML
        expect(res.body).not.toContain('<script>');
    });
});
```

---

### Issue #4: Secret Key Management

**Risk Level:** 🔴 **CRITICAL**  
**Impact:** Token forgery, session hijacking, unauthorized access

**Solution:**

**Step 1: Enhanced Environment Validation**

Create `config/secrets.js`:

```javascript
// config/secrets.js
const crypto = require('crypto');

// Validate that all required secrets are present and strong
function validateSecrets() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const requiredSecrets = {
        ENDUSER_JWT_SECRET: {
            required: true,
            minLength: 32,
            description: 'JWT secret for signing access tokens'
        },
        SESSION_SECRET: {
            required: isProduction,
            minLength: 32,
            description: 'Session secret for encrypting session data'
        },
        REFRESH_TOKEN_SECRET: {
            required: isProduction,
            minLength: 32,
            description: 'Secret for refresh token encryption'
        },
        CRYPTO_KEY: {
            required: isProduction,
            minLength: 32,
            description: 'Encryption key for sensitive data'
        }
    };
    
    const errors = [];
    const warnings = [];
    
    Object.entries(requiredSecrets).forEach(([key, config]) => {
        const value = process.env[key];
        
        // Check if required
        if (config.required && !value) {
            errors.push(`❌ Missing required secret: ${key} (${config.description})`);
        }
        
        // Check minimum length
        if (value && value.length < config.minLength) {
            errors.push(`❌ ${key} is too short. Minimum ${config.minLength} characters required, got ${value.length}`);
        }
        
        // Warn if not strong enough
        if (value && !isStrongSecret(value)) {
            warnings.push(`⚠️  ${key} appears weak. Consider using a cryptographically strong value`);
        }
    });
    
    if (errors.length > 0) {
        console.error('\n🔒 Secret Validation Failed:\n');
        errors.forEach(err => console.error(err));
        throw new Error('Critical secrets configuration error');
    }
    
    if (warnings.length > 0 && isProduction) {
        console.warn('\n⚠️  Secret Strength Warnings:\n');
        warnings.forEach(warn => console.warn(warn));
    }
    
    return true;
}

// Check if a secret is cryptographically strong
function isStrongSecret(secret) {
    if (secret.length < 32) return false;
    
    const entropy = calculateEntropy(secret);
    return entropy > 128;  // At least 128 bits of entropy
}

// Calculate Shannon entropy
function calculateEntropy(str) {
    const len = str.length;
    const frequencies = {};
    
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    
    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    
    return entropy * len;
}

// Generate a strong random secret for initialization
function generateStrongSecret(length = 32) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

module.exports = {
    validateSecrets,
    generateStrongSecret,
    isStrongSecret
};
```

**Step 2: Update Entry Point**

Update `src/index.js`:

```javascript
require('dotenv').config();

// Validate secrets before initializing app
const { validateSecrets } = require('../config/secrets');

try {
    validateSecrets();
} catch (err) {
    console.error('Fatal Error:', err.message);
    process.exit(1);
}

// ... rest of app initialization
```

**Step 3: Enhanced JWT Configuration**

Update `utils/jwt.js`:

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Validate JWT secret on module load
if (!process.env.ENDUSER_JWT_SECRET || process.env.ENDUSER_JWT_SECRET.length < 32) {
    throw new Error('ENDUSER_JWT_SECRET must be set and at least 32 characters long');
}

const JWT_SECRET = process.env.ENDUSER_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.NODE_ENV === 'production' ? '15m' : '7d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.NODE_ENV === 'production' ? '7d' : '30d';

// Sign access token with proper configuration
exports.signAccessToken = (user, app) => {
    return jwt.sign(
        {
            sub: user._id,
            appId: app._id,
            tokenVersion: user.tokenVersion,
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        {
            expiresIn: JWT_EXPIRES_IN,
            algorithm: 'HS256',
            issuer: 'voult.dev',
            audience: app._id.toString()
        }
    );
};

// Verify token with strict validation
exports.verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET, {
            algorithms: ['HS256'],
            issuer: 'voult.dev'
        });
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        }
        if (err.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        throw err;
    }
};

// Generate cryptographically secure refresh token
exports.signRefreshToken = () => {
    return crypto.randomBytes(64).toString('hex');
};
```

**Step 4: Secret Rotation Implementation**

Create `services/secretRotation.js`:

```javascript
const crypto = require('crypto');

class SecretRotationService {
    constructor(secretName, rotationIntervalDays = 90) {
        this.secretName = secretName;
        this.rotationIntervalDays = rotationIntervalDays;
        this.lastRotation = process.env[`${secretName}_ROTATION_DATE`] 
            ? new Date(process.env[`${secretName}_ROTATION_DATE`])
            : new Date();
    }
    
    shouldRotate() {
        const rotationDate = new Date(this.lastRotation);
        rotationDate.setDate(rotationDate.getDate() + this.rotationIntervalDays);
        return new Date() > rotationDate;
    }
    
    generateNewSecret(length = 32) {
        return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    }
    
    getRotationDate() {
        return this.lastRotation;
    }
    
    logRotation(oldSecret, newSecret) {
        console.log(`\n🔄 Secret Rotation Required: ${this.secretName}`);
        console.log(`Last rotated: ${this.lastRotation.toISOString()}`);
        console.log(`Next rotation due: ${new Date(this.lastRotation.getTime() + this.rotationIntervalDays * 24 * 60 * 60 * 1000).toISOString()}`);
        console.log('\nNew secret generated. Update your .env file:');
        console.log(`${this.secretName}=${newSecret}`);
    }
}

module.exports = SecretRotationService;
```

**Step 5: Updated .env.example**

```bash
# ============================================
# 🔒 SECURITY - CRITICAL SECRETS
# ============================================

# JWT secret for signing access tokens (MINIMUM 32 characters, use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENDUSER_JWT_SECRET=your_very_strong_secret_key_at_least_32_chars_long

# Session secret for encrypting session data (MINIMUM 32 characters)
SESSION_SECRET=your_session_secret_at_least_32_chars_long

# Refresh token secret (MINIMUM 32 characters)
REFRESH_TOKEN_SECRET=your_refresh_token_secret_at_least_32_chars_long

# Encryption key for sensitive data (MINIMUM 32 characters)
CRYPTO_KEY=your_crypto_key_at_least_32_chars_long

# Secret rotation tracking
ENDUSER_JWT_SECRET_ROTATION_DATE=2026-05-13
SESSION_SECRET_ROTATION_DATE=2026-05-13
REFRESH_TOKEN_SECRET_ROTATION_DATE=2026-05-13

# ============================================
# Environment
# ============================================
NODE_ENV=production
BASE_URL=https://www.voult.dev
PORT=3000

# ============================================
# Database
# ============================================
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/voult

# ============================================
# Email Configuration
# ============================================
GMAIL_USER=your_email@gmail.com
GMAIL_PASSWORD=your_app_specific_password

# ============================================
# Security Headers
# ============================================
ALLOWED_ORIGINS=https://www.voult.dev,https://voult.dev
CORS_ORIGIN=https://www.voult.dev
```

**Implementation Checklist:**

- Generate strong secrets using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Update `.env` with all required secrets (minimum 32 characters each)
- Set up secret rotation reminder (every 90 days)
- Implement secret version tracking
- Test secret validation on app startup
- Document secret rotation procedure for team

---

## 🔴 HIGH PRIORITY ISSUES

### Issue #5: SQL/NoSQL Injection Hardening

**Risk Level:** 🔴 **HIGH**  
**Impact:** Unauthorized data access, data manipulation, complete database compromise

**Solution:**

Create `middleware/queryValidation.js`:

```javascript
const mongoose = require('mongoose');

// Prevent common NoSQL injection patterns
const validateMongoQuery = (query) => {
    if (typeof query !== 'object') return true;
    
    const dangerousPatterns = [
        '$where',
        '$regex',
        'mapReduce',
        'function'
    ];
    
    const queryString = JSON.stringify(query);
    
    for (const pattern of dangerousPatterns) {
        if (queryString.includes(pattern)) {
            throw new Error(`Dangerous query pattern detected: ${pattern}`);
        }
    }
    
    return true;
};

// Safe query builder
class SafeQueryBuilder {
    constructor(Model) {
        this.Model = Model;
    }
    
    findById(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error('Invalid ObjectId');
        }
        return this.Model.findById(id);
    }
    
    findOne(query) {
        validateMongoQuery(query);
        return this.Model.findOne(query);
    }
    
    find(query, options = {}) {
        validateMongoQuery(query);
        const safeOptions = {
            limit: Math.min(options.limit || 50, 100),  // Max 100 results
            skip: Math.max(options.skip || 0, 0),
            ...options
        };
        return this.Model.find(query, null, safeOptions);
    }
    
    updateOne(filter, update) {
        validateMongoQuery(filter);
        validateMongoQuery(update);
        return this.Model.updateOne(filter, update);
    }
    
    deleteOne(filter) {
        validateMongoQuery(filter);
        return this.Model.deleteOne(filter);
    }
}

module.exports = {
    validateMongoQuery,
    SafeQueryBuilder
};
```

Update controllers to use SafeQueryBuilder:

```javascript
// controllers/api/auth.js
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const EndUser = require('../../models/endUser');

const userBuilder = new SafeQueryBuilder(EndUser);

module.exports.emailLogin = async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = email.trim().toLowerCase();
    
    // Use safe query builder
    const user = await userBuilder
        .findOne({
            app: req.appClient._id,
            email: normalizedEmail,
            deletedAt: null
        })
        .select('+passwordHash');
    
    // ... rest of logic
};
```

---

### Issue #6: Security Headers Implementation

**Risk Level:** 🔴 **HIGH**  
**Impact:** Clickjacking, MIME sniffing, cache poisoning attacks

Already covered above in XSS Prevention (Issue #3). The `helmet` middleware with CSP headers is the solution.

---

### Issue #7: Email Enumeration Prevention

**Risk Level:** 🟡 **HIGH**  
**Impact:** User enumeration attacks, account discovery

**Solution:**

Create `utils/constantTimeComparison.js`:

```javascript
// Prevent timing attacks in email enumeration
function constantTimeCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    
    return result === 0;
}

module.exports = { constantTimeCompare };
```

Update password reset endpoint:

```javascript
// controllers/api/user.js
const { constantTimeCompare } = require('../../utils/constantTimeComparison');

module.exports.resetPassword = async (req, res) => {
    const { password } = req.body;
    const { token, appId } = req.query;
    
    if (!token || !appId || !password) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Token, appId and password are required');
    }
    
    if (!validatePassword(password)) {
        throw new ApiError(400, 'WEAK_PASSWORD', PASSWORD_RULES_MESSAGE);
    }
    
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    
    const user = await EndUser.findOne({
        app: appId,
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
        // ✅ Always return same generic message (prevents enumeration)
        return res.status(400).json({
            error: 'INVALID_RESET_LINK',
            message: 'Password reset link is invalid or expired'
        });
    }
    
    // Add delay to prevent timing attacks
    const delay = Math.random() * 100;  // Random 0-100ms delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    await user.setPassword(password);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    
    res.status(200).json({
        message: 'Password reset successfully'
    });
};
```

---

### Issue #8: Audit Logging System

**Risk Level:** 🟡 **HIGH**  
**Impact:** Cannot track security incidents, regulatory compliance failure

**Solution:**

Create `models/auditLog.js`:

```javascript
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            enum: [
                'LOGIN_SUCCESS',
                'LOGIN_FAILURE',
                'LOGIN_ATTEMPT_THROTTLED',
                'REGISTER',
                'PASSWORD_CHANGE',
                'PASSWORD_RESET',
                'EMAIL_VERIFIED',
                'ACCOUNT_DISABLED',
                'ACCOUNT_ENABLED',
                'OAUTH_LOGIN',
                'OAUTH_LINK',
                'OAUTH_UNLINK',
                'TOKEN_REVOKED',
                'SESSION_CREATED',
                'SESSION_REVOKED'
            ],
            required: true
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'EndUser',
            required: true
        },
        appId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'App',
            required: true
        },
        ipAddress: {
            type: String,
            required: true
        },
        userAgent: {
            type: String
        },
        details: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        status: {
            type: String,
            enum: ['SUCCESS', 'FAILURE', 'PENDING'],
            default: 'SUCCESS'
        },
        riskLevel: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
            default: 'LOW'
        },
        geolocation: {
            country: String,
            city: String,
            coordinates: {
                latitude: Number,
                longitude: Number
            }
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true
        }
    },
    { collection: 'auditLogs' }
);

// Indexes for efficient querying
AuditLogSchema.index({ userId: 1, appId: 1, timestamp: -1 });
AuditLogSchema.index({ appId: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });  // For cleanup jobs

module.exports = mongoose.model('AuditLog', AuditLogSchema);
```

Create `services/auditService.js`:

```javascript
const AuditLog = require('../models/auditLog');

class AuditService {
    static async log(action, userId, appId, req, options = {}) {
        try {
            const log = new AuditLog({
                action,
                userId,
                appId,
                ipAddress: this.getClientIp(req),
                userAgent: req.headers['user-agent'],
                details: options.details || {},
                status: options.status || 'SUCCESS',
                riskLevel: options.riskLevel || this.assessRiskLevel(action),
                geolocation: options.geolocation
            });
            
            await log.save();
            
            // Alert on high-risk actions
            if (log.riskLevel === 'HIGH' || log.riskLevel === 'CRITICAL') {
                await this.sendSecurityAlert(log);
            }
            
            return log;
        } catch (err) {
            console.error('Audit logging failed:', err);
            // Don't throw - logging shouldn't break the app
        }
    }
    
    static getClientIp(req) {
        return req.headers['x-forwarded-for']?.split(',')[0] 
            || req.connection.remoteAddress 
            || req.ip;
    }
    
    static assessRiskLevel(action) {
        const highRiskActions = [
            'PASSWORD_CHANGE',
            'PASSWORD_RESET',
            'ACCOUNT_DISABLED',
            'OAUTH_UNLINK',
            'TOKEN_REVOKED'
        ];
        
        if (highRiskActions.includes(action)) {
            return 'HIGH';
        }
        
        return 'LOW';
    }
    
    static async sendSecurityAlert(log) {
        // TODO: Send alert email or SMS
        console.warn(`🚨 Security Alert: ${log.action} by user ${log.userId}`);
    }
    
    static async getAuditTrail(userId, appId, options = {}) {
        const query = { userId, appId };
        
        if (options.startDate || options.endDate) {
            query.timestamp = {};
            if (options.startDate) query.timestamp.$gte = options.startDate;
            if (options.endDate) query.timestamp.$lte = options.endDate;
        }
        
        return AuditLog.find(query)
            .sort({ timestamp: -1 })
            .limit(options.limit || 50)
            .skip(options.skip || 0);
    }
}

module.exports = AuditService;
```

Update auth controller to use audit logging:

```javascript
// controllers/api/auth.js
const AuditService = require('../../services/auditService');

module.exports.emailLogin = async (req, res) => {
    const { email, password } = req.body;
    const app = req.appClient;
    
    try {
        const user = await EndUser.findOne({
            app: app._id,
            email: email.toLowerCase(),
            deletedAt: null
        }).select('+passwordHash');
        
        if (!user) {
            // Log failed attempt
            await AuditService.log('LOGIN_FAILURE', null, app._id, req, {
                details: { email, reason: 'USER_NOT_FOUND' },
                status: 'FAILURE',
                riskLevel: 'MEDIUM'
            });
            throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }
        
        const isValid = await user.verifyPassword(password);
        
        if (!isValid) {
            await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
                details: { email, reason: 'INVALID_PASSWORD' },
                status: 'FAILURE',
                riskLevel: 'MEDIUM'
            });
            throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }
        
        // Log successful login
        await AuditService.log('LOGIN_SUCCESS', user._id, app._id, req, {
            details: { email }
        });
        
        // ... rest of login logic
    } catch (err) {
        throw err;
    }
};
```

---

## 🟡 MEDIUM PRIORITY ISSUES

### Issue #9: Advanced Rate Limiting

**Risk Level:** 🟡 **MEDIUM**  
**Impact:** Brute force attacks, API abuse, denial of service

**Solution:**

Create `middleware/advancedRateLimiting.js`:

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Create Redis client
const redisClient = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
});

redisClient.on('error', (err) => {
    console.error('Redis error:', err);
    // Fall back to memory store if Redis unavailable
});

// Per-user rate limiting
const createPerUserLimiter = (windowMs, max, message) => {
    return rateLimit({
        store: new RedisStore({
            client: redisClient,
            prefix: 'rl:' // Rate limit prefix
        }),
        windowMs,
        max,
        message: { error: message },
        keyGenerator: (req) => req.user?._id || req.ip,
        skip: (req) => {
            // Skip rate limiting for trusted IPs
            const trustedIps = (process.env.TRUSTED_IPS || '').split(',');
            return trustedIps.includes(req.ip);
        }
    });
};

// Per-email rate limiting (for login attempts)
const emailBasedLimiter = (windowMs, max) => {
    return rateLimit({
        store: new RedisStore({
            client: redisClient,
            prefix: 'email_rl:'
        }),
        windowMs,
        max,
        message: { error: 'Too many attempts for this email. Try again later.' },
        keyGenerator: (req) => req.body.email || req.ip
    });
};

// Per-IP rate limiting
const ipBasedLimiter = (windowMs, max) => {
    return rateLimit({
        store: new RedisStore({
            client: redisClient,
            prefix: 'ip_rl:'
        }),
        windowMs,
        max,
        keyGenerator: (req) => req.ip
    });
};

module.exports = {
    createPerUserLimiter,
    emailBasedLimiter,
    ipBasedLimiter,
    redisClient
};
```

Install Redis store:

```bash
npm install redis rate-limit-redis
```

Update routes to use advanced limiting:

```javascript
// routes/api/auth.js
const { emailBasedLimiter, ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

// Strict limiting on sensitive endpoints
router.post(
    '/email-login',
    emailBasedLimiter(15 * 60 * 1000, 5),  // 5 attempts per email per 15 minutes
    ipBasedLimiter(60 * 60 * 1000, 20),   // 20 attempts per IP per hour
    authController.emailLogin
);

router.post(
    '/register',
    ipBasedLimiter(60 * 60 * 1000, 10),   // 10 registrations per IP per hour
    authController.register
);
```

---

### Issue #10: MFA Implementation (TOTP)

**Risk Level:** 🟡 **MEDIUM**  
**Impact:** Account takeover, unauthorized access after credential breach

**Solution:**

Install dependencies:

```bash
npm install speakeasy qrcode
```

Create `services/mfaService.js`:

```javascript
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

class MFAService {
    // Generate TOTP secret for user
    static generateSecret(userEmail) {
        const secret = speakeasy.generateSecret({
            name: `Voult (${userEmail})`,
            issuer: 'Voult',
            length: 32
        });
        
        return secret;
    }
    
    // Generate QR code for scanning
    static async generateQRCode(secret) {
        const qrCode = await QRCode.toDataURL(secret.otpauth_url);
        return qrCode;
    }
    
    // Verify TOTP token
    static verifyToken(secret, token) {
        return speakeasy.totp.verify({
            secret: secret,
            encoding: 'base32',
            token: token,
            window: 2  // Allow 2 time windows (±30 seconds)
        });
    }
    
    // Generate backup codes
    static generateBackupCodes(count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        return codes;
    }
    
    // Hash backup codes for storage
    static hashBackupCode(code) {
        return crypto.createHash('sha256').update(code).digest('hex');
    }
}

module.exports = MFAService;
```

Update EndUser model:

```javascript
// models/endUser.js
const schema = new mongoose.Schema({
    // ... existing fields
    
    mfaEnabled: {
        type: Boolean,
        default: false
    },
    mfaSecret: {
        type: String,
        select: false
    },
    mfaBackupCodes: {
        type: [String],  // Hashed codes
        select: false
    },
    mfaEnabledAt: Date,
    
    // Track failed TOTP attempts
    failedMfaAttempts: {
        type: Number,
        default: 0
    },
    mfaLockUntil: Date
});
```

Create MFA endpoints:

```javascript
// controllers/api/mfa.js
const MFAService = require('../../services/mfaService');
const EndUser = require('../../models/endUser');

// Enable MFA - Step 1: Generate Secret
exports.enableMfaStep1 = async (req, res) => {
    const user = req.endUser;
    
    if (user.mfaEnabled) {
        throw new ApiError(400, 'MFA_ALREADY_ENABLED', 'MFA is already enabled for this account');
    }
    
    const secret = MFAService.generateSecret(user.email);
    const qrCode = await MFAService.generateQRCode(secret);
    const backupCodes = MFAService.generateBackupCodes();
    
    // Store temporarily in session
    req.session.mfaSetup = {
        secret: secret.base32,
        backupCodes: backupCodes
    };
    
    res.status(200).json({
        qrCode,
        backupCodes,
        message: 'Scan QR code with authenticator app and enter the 6-digit code to confirm'
    });
};

// Enable MFA - Step 2: Verify and Enable
exports.enableMfaStep2 = async (req, res) => {
    const { token } = req.body;
    const user = req.endUser;
    
    if (!req.session.mfaSetup) {
        throw new ApiError(400, 'SESSION_ERROR', 'MFA setup session expired');
    }
    
    const isValid = MFAService.verifyToken(req.session.mfaSetup.secret, token);
    
    if (!isValid) {
        throw new ApiError(400, 'INVALID_MFA_TOKEN', 'Invalid MFA token. Try again.');
    }
    
    // Hash backup codes
    const hashedCodes = req.session.mfaSetup.backupCodes.map(code => 
        MFAService.hashBackupCode(code)
    );
    
    // Enable MFA
    user.mfaEnabled = true;
    user.mfaSecret = req.session.mfaSetup.secret;
    user.mfaBackupCodes = hashedCodes;
    user.mfaEnabledAt = new Date();
    
    await user.save();
    
    // Clear session
    delete req.session.mfaSetup;
    
    res.status(200).json({
        message: 'MFA enabled successfully',
        mfaEnabled: true
    });
};

// Login with MFA
exports.loginWithMfa = async (req, res) => {
    const { mfaToken } = req.body;
    const user = req.session.pendingUser;  // Set after password verification
    
    if (!user.mfaEnabled) {
        throw new ApiError(400, 'MFA_NOT_ENABLED', 'MFA not enabled for this account');
    }
    
    // Check if account is locked
    if (user.mfaLockUntil && user.mfaLockUntil > new Date()) {
        throw new ApiError(423, 'ACCOUNT_LOCKED', 'Too many failed MFA attempts');
    }
    
    // Get unselected fields
    const userData = await EndUser.findById(user._id).select('+mfaSecret +mfaBackupCodes');
    
    // Try TOTP token
    const isTotpValid = MFAService.verifyToken(userData.mfaSecret, mfaToken);
    
    if (!isTotpValid) {
        // Try backup code
        const isBackupValid = userData.mfaBackupCodes.some(hashedCode => 
            MFAService.hashBackupCode(mfaToken) === hashedCode
        );
        
        if (!isBackupValid) {
            userData.failedMfaAttempts += 1;
            
            if (userData.failedMfaAttempts >= 5) {
                userData.mfaLockUntil = new Date(Date.now() + 15 * 60 * 1000);
            }
            
            await userData.save();
            throw new ApiError(401, 'INVALID_MFA_TOKEN', 'Invalid MFA token');
        }
        
        // Remove used backup code
        userData.mfaBackupCodes = userData.mfaBackupCodes.filter(
            code => code !== MFAService.hashBackupCode(mfaToken)
        );
    }
    
    // Reset failed attempts
    userData.failedMfaAttempts = 0;
    userData.mfaLockUntil = null;
    await userData.save();
    
    // Generate tokens
    const accessToken = signAccessToken(userData, req.appClient);
    const refreshToken = await createRefreshToken({
        endUser: userData,
        app: req.appClient,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });
    
    delete req.session.pendingUser;
    
    res.status(200).json({
        message: 'Login successful',
        accessToken,
        refreshToken
    });
};
```

---

## 🟢 IMPLEMENTATION ROADMAP

### Phase 1: Critical Fixes (Weeks 1-2)

- Session cookie security configuration
- CSRF protection middleware
- XSS prevention & sanitization
- Secret key management validation
- Testing & validation

**Deliverable:** Eliminate all 🔴 CRITICAL security risks

### Phase 2: High Priority (Weeks 3-4)

- NoSQL injection hardening
- Security headers (Helmet)
- Email enumeration prevention
- Audit logging system
- Documentation updates

**Deliverable:** Implement 🔴 HIGH priority protections

### Phase 3: Medium Priority (Weeks 5-6)

- Advanced rate limiting with Redis
- MFA/TOTP implementation
- Backup codes system
- API rate limiting refinement

**Deliverable:** Add 🟡 MEDIUM priority features

### Phase 4: Advanced Features (Weeks 7-8)

- WebAuthn passwordless authentication
- IP allowlisting system
- Session management dashboard
- Incident response automation

**Deliverable:** Enterprise-grade security features

### Phase 5: Pre-Launch Validation (Weeks 9-10)

- Security audit & penetration testing
- Compliance verification (GDPR, CCPA)
- Load testing with security measures
- Documentation finalization
- Team training & runbooks

**Deliverable:** Production-ready certification

---

## 📊 Updated Environment Configuration

Create `.env.production` with all security settings:

```bash
# Production Security Configuration
NODE_ENV=production
DEBUG=false

# URLs
BASE_URL=https://www.voult.dev
ALLOWED_ORIGINS=https://www.voult.dev,https://app.voult.dev

# Security Secrets (Generated with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENDUSER_JWT_SECRET=xxxxxxxxxxxxxxxxxxxxx  # Min 32 chars
SESSION_SECRET=xxxxxxxxxxxxxxxxxxxxx      # Min 32 chars
REFRESH_TOKEN_SECRET=xxxxxxxxxxxxxxxxxxxxx  # Min 32 chars
CRYPTO_KEY=xxxxxxxxxxxxxxxxxxxxx          # Min 32 chars

# Database
MONGODB_URI=mongodb+srv://secured_user:secured_password@cluster.mongodb.net/voult_prod

# Email
GMAIL_USER=security@voult.dev
GMAIL_PASSWORD=xxxxx  # App-specific password

# Redis (for rate limiting)
REDIS_HOST=redis.voult.dev
REDIS_PORT=6379
REDIS_PASSWORD=xxxxx
TRUSTED_IPS=203.0.113.1,203.0.113.2  # Monitoring/health check IPs

# Monitoring
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
LOG_LEVEL=info
```

---

## ✅ Security Testing Checklist

### Unit Tests

- Password hashing verified
- JWT token validation
- CSRF token generation and validation
- Rate limiting behavior
- Input sanitization

### Integration Tests

- End-to-end authentication flow with CSRF
- MFA enrollment and login
- Audit logging for all actions
- Session security across requests

### Security Tests

- OWASP Top 10 vulnerability scan
- Penetration testing
- XSS payload injection tests
- SQL/NoSQL injection attempts
- CSRF attack simulation
- Rate limiting bypass attempts
- JWT signature verification

### Performance Tests

- Rate limiting performance impact
- Audit logging query performance
- Redis failover handling
- JWT verification latency

---

## 📋 Pre-Launch Security Checklist

### Code Quality

- No hardcoded secrets in codebase
- All environment variables documented
- Code review completed
- Security linting enabled (`eslint-plugin-security`)
- Dependency vulnerabilities resolved

### Infrastructure

- HTTPS/TLS configured (minimum TLS 1.2)
- Security headers enabled
- Database encryption at rest
- Database backups encrypted
- VPN/private network for database access
- WAF (Web Application Firewall) enabled
- DDoS protection active

### Compliance

- Privacy Policy published
- Terms of Service published
- GDPR data processing agreement
- CCPA privacy rights framework
- SOC 2 compliance plan
- Data retention policy

### Monitoring & Alerting

- Security event logging active
- Real-time alerting for suspicious activity
- Incident response plan documented
- Team trained on incident response
- Penetration testing scheduled (quarterly)

### Documentation

- Security architecture documented
- Threat model created
- Security runbooks prepared
- Data flow diagrams created
- API security guidelines published

---

## 🚨 Incident Response Plan

Create `docs/INCIDENT_RESPONSE_PLAN.md`:

```markdown
# Incident Response Plan

## 1. Detection
- Monitor audit logs for suspicious patterns
- Set up alerts for:
  - Multiple failed login attempts
  - Unusual data access patterns
  - Unexpected API usage spikes
  - Certificate errors

## 2. Response
- **Immediate (0-15 minutes)**
  - Acknowledge incident
  - Gather evidence
  - Notify security team

- **Short-term (15 min - 2 hours)**
  - Isolate affected systems
  - Revoke compromised tokens
  - Reset passwords if needed

- **Medium-term (2-24 hours)**
  - Complete investigation
  - Determine root cause
  - Implement temporary mitigations

- **Long-term (1-7 days)**
  - Implement permanent fixes
  - Update security measures
  - Notify affected users
  - Post-mortem analysis

## 3. Communication
- Internal: Alert security@voult.dev
- Customers: Prepare notification within 2 hours
- Public: Blog post if needed within 24 hours
```

---

## 📈 Security Metrics

Track these metrics to ensure ongoing security:

```javascript
// services/securityMetrics.js
class SecurityMetrics {
    static async getSecurityScore() {
        const metrics = {
            failedLogins: await getFailedLoginCount(),
            mfaAdoption: await getMFAAdoptionRate(),
            passwordAge: await getAveragePasswordAge(),
            encryptionCoverage: await getEncryptionCoverage(),
            patchStatus: await getPatchStatus(),
            vulnerabilityStatus: await getVulnerabilityStatus()
        };
        
        return this.calculateScore(metrics);
    }
    
    static calculateScore(metrics) {
        // Implementation
    }
}
```

---

## 🎓 Security Training

Required training for team:

1. **OWASP Top 10** - Understanding common web vulnerabilities
2. **Secure Coding** - Best practices for authentication
3. **Incident Response** - How to handle security events
4. **Data Privacy** - GDPR/CCPA compliance
5. **Security Operations** - Monitoring and alerting
6. **Penetration Testing** - Understanding attack vectors

---

## 📞 Support & Escalation

- **Security Issues:** [security@voult.dev](mailto:security@voult.dev)
- **Urgent:** Escalate to @DevOlabode
- **Response SLA:** 1 hour for critical issues
- **Public Disclosure:** Follow 90-day policy

---

## 📚 Additional Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [OAuth 2.0 Security Best Practices](https://tools.ietf.org/html/draft-ietf-oauth-security-topics)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

**Last Updated:** May 13, 2026  
**Next Review:** August 13, 2026  
**Status:** Draft - Under Implementation