const express = require('express');
const router = express.Router();

const { apiLimiter } = require('../../middleware/rateLimiters');
const { csrfProtection } = require('../../middleware/csrfProtection');
const verifyClient = require('../../middleware/verifyClient').verifyClient;
const authController = require('../../controllers/api/auth');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');
const { authLimiter } = require('../../middleware/rateLimiters');
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

router.post('/register', csrfProtection, validate(schemas.registerSchema), verifyClient, validateCallbackUrl, authLimiter, catchAsync(authController.register));

router.post('/username-register', csrfProtection, validate(schemas.usernameRegisterSchema), verifyClient, validateCallbackUrl, authLimiter, catchAsync(authController.usernameRegister));

router.post('/email-login', csrfProtection, validate(schemas.loginSchema), verifyClient, authLimiter, validateCallbackUrl, catchAsync(authController.emailLogin));  

router.post('/username-login', csrfProtection, validate(schemas.usernameLoginSchema), verifyClient, authLimiter, validateCallbackUrl, catchAsync(authController.usernameLogin));

router.post('/logout', csrfProtection, verifyClient, requireEndUserAuth, requireActiveEndUser, authLimiter, validateCallbackUrl, catchAsync(authController.logout));

module.exports = router;