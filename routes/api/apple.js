const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/apple');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');

const validateCallbackUrl = require('../../middleware/validateCallbackUrl');
const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.appleRegister));

router.post('/login', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.appleLogin));

router.post('/authenticate', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.appleAuthenticate));

module.exports = router;
