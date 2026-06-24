const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/microsoft');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/auth/microsoft/register', csrfProtection, verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.microsoftRegister));

router.post('/auth/microsoft/login', csrfProtection, verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.microsoftLogin));

module.exports = router;