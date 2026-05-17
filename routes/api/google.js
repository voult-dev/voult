const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/google');

const { verifyClient, verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const validateCallbackUrl = require('../../middleware/validateCallbackUrl');
const { authLimiter } = require('../../middleware/rateLimiters');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', csrfProtection, verifyClientIdOnly, validateCallbackUrl, authLimiter, catchAsync(controller.googleRegister));

router.post('/login', csrfProtection, verifyClientIdOnly, validateCallbackUrl, authLimiter, catchAsync(controller.googleLogin));

module.exports = router;