const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/linkedin');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');

const validateCallbackUrl = require('../../middleware/validateCallbackUrl');
const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.linkedinRegister));

router.post('/login', verifyClientIdOnly, validateCallbackUrl, ipBasedLimiter, catchAsync(controller.linkedinLogin));

module.exports = router;