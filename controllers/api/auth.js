const EndUser = require('../../models/endUser');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');

const { signEndUserToken, signAccessToken, createRefreshToken } = require('../../utils/jwt');
const { ApiError } = require('../../utils/apiError');

const AuditService = require('../../services/auditService');
const App = require('../../models/app');
const RefreshToken = require('../../models/refreshToken');

const endUserBuilder = new SafeQueryBuilder(EndUser);
const appBuilder = new SafeQueryBuilder(App);
const refreshTokenBuilder = new SafeQueryBuilder(RefreshToken);

// EMAILS
const {verifyEndUsers} = require('../../services/emailService');
const { accountLockedEmail } = require('../../services/emailOnLock');

// INPUT SANITIZATION
const { sanitize } = require('../../middleware/inputSanitization');

// PASSWORDS RULES
const { validatePassword } = require('../../validators/password');
const { PASSWORD_RULES_MESSAGE } = require('../../constants/passwordRules');

// =======================
// REGISTER
// =======================
module.exports.register = async (req, res) => {
  console.log('[AUTH] register() called - app:', req.appClient?.clientId);
  try {
    const { email, password, fullName, username } = req.body;
    
    // Sanitize inputs
    const sanitizedEmail = sanitize(typeof email === 'string' ? email.trim().toLowerCase() : '');
    const sanitizedUsername = sanitize(typeof username === 'string' ? username.trim().toLowerCase() : '');
    const sanitizedFullName = sanitize(fullName || '');

    const app = req.appClient;

    if (!app) {
      console.error('[AUTH] register() - ERROR: req.appClient is undefined');
      throw new ApiError(401, 'INVALID_CLIENT', 'App client validation failed');
    }

    if (!sanitizedEmail || !password) {
      await AuditService.log('REGISTER', null, app._id, req, {
        details: { email: sanitizedEmail, reason: 'VALIDATION_ERROR' },
        status: 'FAILURE',
        riskLevel: 'MEDIUM'
      });
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Email and password are required'
      );
    }

    // Validate username format if provided
    if (sanitizedUsername) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
      if (!usernameRegex.test(sanitizedUsername)) {
        await AuditService.log('REGISTER', null, app._id, req, {
          details: { email: sanitizedEmail, username: sanitizedUsername, reason: 'INVALID_USERNAME' },
          status: 'FAILURE',
          riskLevel: 'LOW'
        });
        throw new ApiError(
          400,
          'INVALID_USERNAME',
          'Username must be 3-30 characters, alphanumeric and underscores only'
        );
      }

      // Check if username is already taken
      const existingUsernameUser = await endUserBuilder.findOne({
        app: app._id,
        username: sanitizedUsername,
        deletedAt: null
      });

      if (existingUsernameUser) {
        await AuditService.log('REGISTER', existingUsernameUser._id, app._id, req, {
          details: { email: sanitizedEmail, username: sanitizedUsername, reason: 'USERNAME_TAKEN' },
          status: 'FAILURE',
          riskLevel: 'LOW'
        });
        throw new ApiError(
          409,
          'USERNAME_TAKEN',
          'Username is already taken'
        );
      }
    }

    const existingUser = await endUserBuilder.findOne({
      app: app._id,
      email: sanitizedEmail
    });

    if (existingUser) {
      await AuditService.log('REGISTER', existingUser._id, app._id, req, {
        details: { email: sanitizedEmail, reason: 'USER_EXISTS' },
        status: 'FAILURE',
        riskLevel: 'LOW'
      });
      throw new ApiError(
        409,
        'USER_EXISTS',
        'User with that email already exists'
      );
    };

    if (!validatePassword(password)) {
      await AuditService.log('REGISTER', null, app._id, req, {
        details: { email: sanitizedEmail, reason: 'WEAK_PASSWORD' },
        status: 'FAILURE',
        riskLevel: 'LOW'
      });
      throw new ApiError(
        400,
        'WEAK_PASSWORD',
        PASSWORD_RULES_MESSAGE
      );
    }
    

    const user = new EndUser({
      fullName: sanitizedFullName,
      app: app._id,
      email: sanitizedEmail,
      username: sanitizedUsername || undefined
    });

    await user.setPassword(password);

    const appO = await appBuilder.findById(app._id);

    const userPerApp = await endUserBuilder.countDocuments({app : appO._id});
    appO.usage.totalRegistrations = userPerApp;

    await appO.save();
    
    const DBapp = await App.findById(app._id);
    const users = await EndUser.countDocuments({app: app._id});
    DBapp.users = users;
    await DBapp.save();

    const verifyToken = await user.generateEmailVerificationToken();

    const baseUrl = (process.env.BASE_URL || '').trim();
    if (!baseUrl) {
      throw new ApiError(500, 'CONFIG_ERROR', 'BASE_URL is not set. Set BASE_URL in .env (e.g. BASE_URL=https://www.voult.dev) with no spaces around =.');
    }
    const verifyUrl = `${baseUrl}/api/user/verify-email?token=${verifyToken}&appId=${app._id}`;

    const token = signEndUserToken(user, app);

    await user.save();

    // Send verification email (non-blocking - don't fail registration if email fails)
    verifyEndUsers(
      user.email,
      app.name,
      verifyUrl,
    ).catch(err => {
      console.error('[AUTH] Failed to send verification email:', err.message);
      // Registration still succeeds even if email fails
    });

    await AuditService.log('REGISTER', user._id, app._id, req, {
      details: { email: sanitizedEmail, username: user.username, method: 'email' }
    });

    console.log('[AUTH] register() completed successfully for:', sanitizedEmail);
    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username
      }
    });
  } catch (err) {
    console.error('[AUTH] register() failed:', err.message);
    throw err;
  }
};

// =======================
// USERNAME REGISTER
// =======================
module.exports.usernameRegister = async (req, res) => {
  console.log('[AUTH] usernameRegister() called - app:', req.appClient?.clientId);
  const { username, password, fullName, email } = req.body;
  
  // Sanitize inputs
  const sanitizedUsername = sanitize(typeof username === 'string' ? username.trim().toLowerCase() : '');
  const sanitizedEmail = sanitize(typeof email === 'string' ? email.trim().toLowerCase() : '');
  const sanitizedFullName = sanitize(fullName || '');

  const app = req.appClient;

  // Username and password are required
  if (!sanitizedUsername || !password) {
    await AuditService.log('REGISTER', null, app._id, req, {
      details: { username: sanitizedUsername, reason: 'VALIDATION_ERROR' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Username and password are required'
    );
  }

  // Validate username format
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  if (!usernameRegex.test(sanitizedUsername)) {
    await AuditService.log('REGISTER', null, app._id, req, {
      details: { username: sanitizedUsername, reason: 'INVALID_USERNAME' },
      status: 'FAILURE',
      riskLevel: 'LOW'
    });
    throw new ApiError(
      400,
      'INVALID_USERNAME',
      'Username must be 3-30 characters, alphanumeric and underscores only'
    );
  }

  // Check if username is already taken
  const existingUsernameUser = await endUserBuilder.findOne({
    app: app._id,
    username: sanitizedUsername,
    deletedAt: null
  });

  if (existingUsernameUser) {
    await AuditService.log('REGISTER', existingUsernameUser._id, app._id, req, {
      details: { username: sanitizedUsername, reason: 'USERNAME_TAKEN' },
      status: 'FAILURE',
      riskLevel: 'LOW'
    });
    throw new ApiError(
      409,
      'USERNAME_TAKEN',
      'Username is already taken'
    );
  }

  // Check if email is already taken (if provided)
  if (sanitizedEmail) {
    const existingEmailUser = await endUserBuilder.findOne({
      app: app._id,
      email: sanitizedEmail,
      deletedAt: null
    });

    if (existingEmailUser) {
      await AuditService.log('REGISTER', existingEmailUser._id, app._id, req, {
        details: { username: sanitizedUsername, email: sanitizedEmail, reason: 'USER_EXISTS' },
        status: 'FAILURE',
        riskLevel: 'LOW'
      });
      throw new ApiError(
        409,
        'USER_EXISTS',
        'User with that email already exists'
      );
    }
  }

  // Validate password strength
  if (!validatePassword(password)) {
    await AuditService.log('REGISTER', null, app._id, req, {
      details: { username: sanitizedUsername, reason: 'WEAK_PASSWORD' },
      status: 'FAILURE',
      riskLevel: 'LOW'
    });
    throw new ApiError(
      400,
      'WEAK_PASSWORD',
      PASSWORD_RULES_MESSAGE
    );
  }

  // Create user with username (email is optional)
  const user = new EndUser({
    fullName: sanitizedFullName,
    app: app._id,
    username: sanitizedUsername,
    email: sanitizedEmail || undefined
  });

  await user.setPassword(password);

  const appO = await appBuilder.findById(app._id);

  const userPerApp = await endUserBuilder.countDocuments({ app: appO._id });
  appO.usage.totalRegistrations = userPerApp;

  await appO.save();

  const verifyToken = await user.generateEmailVerificationToken();

  const baseUrl = (process.env.BASE_URL || '').trim();
  if (!baseUrl) {
    throw new ApiError(500, 'CONFIG_ERROR', 'BASE_URL is not set. Set BASE_URL in .env (e.g. BASE_URL=https://www.voult.dev) with no spaces around =.');
  }
  const verifyUrl = `${baseUrl}/api/user/verify-email?token=${verifyToken}&appId=${app._id}`;

  const token = signEndUserToken(user, app);

  await user.save();

  // Send verification email if email was provided (non-blocking)
  if (sanitizedEmail) {
    verifyEndUsers(
      user.email,
      app.name,
      verifyUrl,
    ).catch(err => {
      console.error('Failed to send verification email:', err.message);
    });
  }

  await AuditService.log('REGISTER', user._id, app._id, req, {
    details: { username: sanitizedUsername, email: user.email, method: 'username' }
  });

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: user._id,
      username: user.username,
      email: user.email
    }
  });
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000;

// =======================
// LOGIN
// =======================
module.exports.emailLogin = async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const app = req.appClient;

  if (!normalizedEmail || !password) {
    await AuditService.log('LOGIN_FAILURE', null, app._id, req, {
      details: { email, reason: 'VALIDATION_ERROR' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(400, 'VALIDATION_ERROR', 'Email and password are required');
  }

  const user = await endUserBuilder.findOne({
    app: app._id,
    email: normalizedEmail,
    deletedAt: null
  }).select('+passwordHash');

  if (!user) {
    await AuditService.log('LOGIN_FAILURE', null, app._id, req, {
      details: { email: normalizedEmail, reason: 'USER_NOT_FOUND' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.lockUntil && user.lockUntil > Date.now()) {
    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { email: normalizedEmail, reason: 'ACCOUNT_LOCKED' },
      status: 'FAILURE',
      riskLevel: 'HIGH'
    });
    throw new ApiError(
      423,
      'ACCOUNT_LOCKED',
      'Too many failed login attempts. Try again later.'
    );
  }

  const isValid = await user.verifyPassword(password);

  if (!isValid) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME);
      console.log('App Name: ', app.name);

      try {
        await accountLockedEmail(
          user.email,
          user.email,
          app.name,
          user.lockUntil,
          'https://voult.dev/support'
        );
      } catch (err) {
        console.error('Account Lock Email Failed: ', err.message);
      }
    }

    await user.save();

    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { email: normalizedEmail, reason: 'INVALID_PASSWORD' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  if (!user.isEmailVerified) {
    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { email: normalizedEmail, reason: 'EMAIL_NOT_VERIFIED' },
      status: 'FAILURE',
      riskLevel: 'LOW'
    });
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email');
  }

  if (!user.isActive) {
    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { email: normalizedEmail, reason: 'ACCOUNT_DISABLED' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  }

  user.lastLoginAt = new Date();

  const appO = await appBuilder.findById(app._id);
  appO.usage.totalLogins += 1;
  await appO.save();

  const accessToken = signAccessToken(user, app);
  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  await user.save();

  await AuditService.log('LOGIN_SUCCESS', user._id, app._id, req, {
    details: { email: normalizedEmail, method: 'email' }
  });

  res.status(200).json({
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      email: user.email
    }
  });
};

// =======================
// USERNAME LOGIN
// =======================

module.exports.usernameLogin = async (req, res) => {
  const { username, password } = req.body;
  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const app = req.appClient;

  if (!normalizedUsername || !password) {
    await AuditService.log('LOGIN_FAILURE', null, app._id, req, {
      details: { username, reason: 'VALIDATION_ERROR' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(400, 'VALIDATION_ERROR', 'Username and password are required');
  }
  
  const user = await endUserBuilder.findOne({
    app: app._id,
    username: normalizedUsername,
    deletedAt: null
  }).select('+passwordHash');
  
  if (!user) {
    await AuditService.log('LOGIN_FAILURE', null, app._id, req, {
      details: { username: normalizedUsername, reason: 'USER_NOT_FOUND' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  if (user.lockUntil && user.lockUntil > Date.now()) {
    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { username: normalizedUsername, reason: 'ACCOUNT_LOCKED' },
      status: 'FAILURE',
      riskLevel: 'HIGH'
    });
    throw new ApiError(
      423,
      'ACCOUNT_LOCKED',
      'Too many failed login attempts. Try again later.'
    );
  }

  const isValid = await user.verifyPassword(password);

  if (!isValid) {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME);
      console.log('App Name: ', app.name);

      try {
        await accountLockedEmail(
          user.email,
          user.email,
          app.name,
          user.lockUntil,
          'https://voult.dev/support'
        );
      } catch (err) {
        console.error('Account Lock Email Failed: ', err.message);
      }
    }

    await user.save();

    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { username: normalizedUsername, reason: 'INVALID_PASSWORD' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
  }

  user.failedLoginAttempts = 0;
  user.lockUntil = null;

  if (user.email && !user.isEmailVerified) {
    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { username: normalizedUsername, reason: 'EMAIL_NOT_VERIFIED' },
      status: 'FAILURE',
      riskLevel: 'LOW'
    });
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email');
  }

  if (!user.isActive) {
    await AuditService.log('LOGIN_FAILURE', user._id, app._id, req, {
      details: { username: normalizedUsername, reason: 'ACCOUNT_DISABLED' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  }
  
  user.lastLoginAt = new Date();

  const appO = await appBuilder.findById(app._id);
  appO.usage.totalLogins += 1;
  await appO.save();

  const accessToken = signAccessToken(user, app);
  const { rawToken: refreshToken } = await createRefreshToken({
    endUser: user,
    app,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  await user.save();

  await AuditService.log('LOGIN_SUCCESS', user._id, app._id, req, {
    details: { username: normalizedUsername, method: 'username' }
  });

  res.status(200).json({
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      username: user.username,
      email: user.email
    }
  });
};

// =======================
// LOGOUT
// =======================
module.exports.logout = async (req, res) => {
  if (!req.endUser) {
    await AuditService.log('SESSION_REVOKED', null, req.appClient._id, req, {
      details: { reason: 'UNAUTHORIZED' },
      status: 'FAILURE',
      riskLevel: 'MEDIUM'
    });
    throw new ApiError(
      401,
      'UNAUTHORIZED',
      'Authentication required'
    );
  }
  
  // Revoke ALL refresh tokens for this user + app
  await refreshTokenBuilder.updateMany(
    {
      endUser: req.endUser._id,
      app: req.appClient._id,
      revokedAt: null,
    },
    {
      revokedAt: new Date(),
    }
  );

  // Optional hard logout (kills any still-valid access tokens)
  req.endUser.tokenVersion += 1;

  await req.endUser.save();

  await AuditService.log('SESSION_REVOKED', req.endUser._id, req.appClient._id, req, {
    details: { tokenVersion: req.endUser.tokenVersion }
  });

  res.status(200).json({
    message: 'Logged out successfully',
  });
};