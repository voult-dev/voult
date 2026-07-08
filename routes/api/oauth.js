const express = require('express');
const router = express.Router();

const { csrfProtection } = require('../../middleware/csrfProtection');
const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');
const { legacyOAuthDeprecation } = require('../../middleware/deprecationNotice');

const controller = require('../../controllers/api/oauth');

router.use(legacyOAuthDeprecation);

// Generate OAuth authorization URL - IP-based limiting to prevent abuse
router.post('/:provider/authorize', csrfProtection, ipBasedLimiter, controller.generateAuthUrl);

// Handle OAuth callback - IP-based limiting to prevent brute force attempts
router.get('/:provider/callback', ipBasedLimiter, controller.handleCallback);

module.exports = router;
