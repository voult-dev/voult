const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/facebook');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');

const validateCallbackUrl = require('../../middleware/validateCallbackUrl');
const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.facebookRegister));

router.post('/login', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.facebookLogin));

router.post('/authenticate', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.facebookAuthenticate));

module.exports = router;