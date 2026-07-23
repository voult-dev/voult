const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/github');

const { verifyClientIdOnly } = require('../../middleware/verifyClient');

const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync = require('../../utils/catchAsync');

router.post('/register', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.githubRegister));

router.post('/login', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.githubLogin));

router.post('/authenticate', verifyClientIdOnly, ipBasedLimiter, catchAsync(controller.githubAuthenticate));

router.get('/profile', verifyClientIdOnly, catchAsync(controller.githubProfile));

module.exports = router;