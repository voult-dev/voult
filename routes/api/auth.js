const express = require('express');
const router = express.Router();

const { apiLimiter } = require('../../middleware/rateLimiters');

const { emailLoginLimiter, ipAuthLimiter, createPerUserLimiter } = require('../../middleware/advancedRateLimiting');
const verifyClient = require('../../middleware/verifyClient').verifyClient;
const authController = require('../../controllers/api/auth');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');
const { validate } = require('../../validators/validate');
const schemas = require('../../validators/api/endUserAuth');
const validateCallbackUrl = require('../../middleware/validateCallbackUrl');
const catchAsync  = require('../../utils/catchAsync');

router.use(apiLimiter);

/*
  Headers required:
  X-Client-Id: app_xxx
  Authorization: Bearer client_secret
*/

// Registration endpoints - IP-based limiting to prevent mass account creation
router.post('/register', validate(schemas.registerSchema), verifyClient, validateCallbackUrl, ipAuthLimiter, catchAsync(authController.register));

router.post('/username-register', validate(schemas.usernameRegisterSchema), verifyClient, validateCallbackUrl, ipAuthLimiter, catchAsync(authController.usernameRegister));

// Login endpoints - Email-based limiting to prevent brute force on specific accounts
router.post('/email-login', validate(schemas.loginSchema), verifyClient, emailLoginLimiter, validateCallbackUrl, catchAsync(authController.emailLogin));  

router.post('/username-login', validate(schemas.usernameLoginSchema), verifyClient, emailLoginLimiter, validateCallbackUrl, catchAsync(authController.usernameLogin));

// Logout endpoint - Per-user limiting after authentication
router.post('/logout', verifyClient, requireEndUserAuth, requireActiveEndUser, createPerUserLimiter(15 * 60 * 1000, 10, 'Too many logout requests. Please try again later.'), validateCallbackUrl, catchAsync(authController.logout));

module.exports = router;