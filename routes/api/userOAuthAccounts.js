const express = require('express');
const router = express.Router();
const controller = require('../../controllers/api/userOAuthAccounts');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');
const { createPerUserLimiter } = require('../../middleware/advancedRateLimiting');

// Protect all routes with end user authentication
router.use(requireEndUserAuth);
router.use(requireActiveEndUser);

// GET /api/me/oauth - Get linked providers for current user
router.get('/me/oauth', createPerUserLimiter(15 * 60 * 1000, 30, 'Too many requests. Please try again later.'), controller.getLinkedProviders);

// DELETE /api/me/oauth/:provider - Unlink a provider
router.delete('/me/oauth/:provider', createPerUserLimiter(15 * 60 * 1000, 10, 'Too many requests. Please try again later.'), controller.unlinkProvider);

module.exports = router;