const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/microsoft');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');

const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/auth/microsoft/register', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.microsoftRegister));

router.post('/auth/microsoft/login', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.microsoftLogin));

module.exports = router;