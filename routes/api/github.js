const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/github');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', csrfProtection, verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.githubRegister));

router.post('/login', csrfProtection, verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.githubLogin));

router.get('/profile', verifyClientIdOnly, catchAsync(controller.githubProfile));

module.exports = router;