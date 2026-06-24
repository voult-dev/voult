const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/facebook');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const validateCallbackUrl = require('../../middleware/validateCallbackUrl');
const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', csrfProtection, verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.facebookRegister));

router.post('/login', csrfProtection, verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.facebookLogin));

module.exports = router;