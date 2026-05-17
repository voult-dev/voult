const express = require('express');
const router = express.Router();

const { apiLimiter } = require('../../middleware/rateLimiters');


const { verifyClient } = require('../../middleware/verifyClient');
const authController = require('../../controllers/api/auth');

const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');

const { authLimiter } = require('../../middleware/rateLimiters');

const { validate } = require('../../validators/validate');
const schemas = require('../../validators/api/endUserAuth');

const catchAsync  = require('../../utils/catchAsync');

const { csrfProtection } = require('../../middleware/csrfProtection');

const validateCallbackUrl = require('../../middleware/validateCallbackUrl');

const controller = require('../../controllers/api/user');

router.get('/me', catchAsync(controller.me));

router.post('/forgot-password', csrfProtection, verifyClient, catchAsync(controller.forgotPassword));

router.post('/reset-password', csrfProtection, verifyClient, catchAsync(controller.resetPassword));

router.get('/verify-email', catchAsync(controller.verifyEmail));

router.post('/disable', csrfProtection, requireEndUserAuth, requireActiveEndUser, catchAsync(controller.disableAccount));

router.post('/reenable', csrfProtection, requireEndUserAuth, catchAsync(controller.reenableAccount));

router.patch('/me', csrfProtection, requireEndUserAuth, requireActiveEndUser, catchAsync(controller.updateProfile));

module.exports = router;