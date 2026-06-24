const express = require('express');
const router = express.Router();

const { verifyClient } = require('../../middleware/verifyClient');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');

const {emailBasedLimiter, ipBasedLimiter} = require('../../middleware/advancedRateLimiting');

const catchAsync  = require('../../utils/catchAsync');

const { csrfProtection } = require('../../middleware/csrfProtection');

const controller = require('../../controllers/api/user');

router.get('/me', catchAsync(controller.me));

// Password reset endpoints - Email-based limiting to prevent targeting specific emails
router.post('/forgot-password', csrfProtection, verifyClient, emailBasedLimiter, catchAsync(controller.forgotPassword));

router.post('/reset-password', csrfProtection, verifyClient, ipBasedLimiter, catchAsync(controller.resetPassword));

router.get('/verify-email', catchAsync(controller.verifyEmail));

router.post('/disable', csrfProtection, requireEndUserAuth, requireActiveEndUser, catchAsync(controller.disableAccount));

router.post('/reenable', csrfProtection, requireEndUserAuth, catchAsync(controller.reenableAccount));

router.patch('/me', csrfProtection, requireEndUserAuth, requireActiveEndUser, catchAsync(controller.updateProfile));

module.exports = router;