const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/apple');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const validateCallbackUrl = require('../../middleware/validateCallbackUrl');
const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/auth/apple/register', csrfProtection, verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.appleRegister));

router.post('/auth/apple/login', csrfProtection, verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.appleLogin));

module.exports = router;