const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/microsoft');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');

const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.microsoftRegister));

router.post('/login', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.microsoftLogin));

router.post('/authenticate', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.microsoftAuthenticate));

module.exports = router;
