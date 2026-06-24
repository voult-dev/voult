const express = require('express');
const router = express.Router();
const controller = require('../../controllers/api/magicLink');

const { csrfProtection } = require('../../middleware/csrfProtection');
const { emailBasedLimiter, ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/send-magic-link', csrfProtection, emailBasedLimiter, catchAsync(controller.sendLink));
router.post('/validate-magic-link', csrfProtection, ipBasedLimiter, catchAsync(controller.validateToken));

module.exports = router;