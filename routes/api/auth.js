const express = require('express');
const router = express.Router();

const { apiLimiter } = require('../../middleware/rateLimiters');

const {emailBasedLimiter, ipBasedLimiter} = require('../../middleware/advancedRateLimiting');
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

router.post('/register', validate(schemas.registerSchema), verifyClient, validateCallbackUrl, authLimiter, catchAsync(authController.register));

router.post('/username-register', validate(schemas.usernameRegisterSchema), verifyClient, validateCallbackUrl, authLimiter, catchAsync(authController.usernameRegister));

router.post('/email-login', validate(schemas.loginSchema), verifyClient, authLimiter, validateCallbackUrl, catchAsync(authController.emailLogin));  

router.post('/username-login', validate(schemas.usernameLoginSchema), verifyClient, authLimiter, validateCallbackUrl, catchAsync(authController.usernameLogin));

router.post('/logout', verifyClient, requireEndUserAuth, requireActiveEndUser, authLimiter, validateCallbackUrl, catchAsync(authController.logout));

module.exports = router;