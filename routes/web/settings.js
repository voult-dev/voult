const express = require('express');
const router = express.Router();
const catchAsync = require('../../utils/catchAsync');
const { isLoggedIn } = require('../../middleware');
const { webAuthLimiter } = require('../../middleware/rateLimiters');
const controller = require('../../controllers/web/settings');

router.get('/settings', isLoggedIn, catchAsync(controller.settingsPage));
router.post('/settings', isLoggedIn, catchAsync(controller.updateSettings));

router.post('/settings/email/request-change', isLoggedIn, webAuthLimiter, catchAsync(controller.requestEmailChange));
router.get('/settings/verify-email/:token', catchAsync(controller.verifyNewEmail));

router.post('/settings/password/set', isLoggedIn, webAuthLimiter, catchAsync(controller.setPassword));
router.post('/settings/password/change', isLoggedIn, webAuthLimiter, catchAsync(controller.changePassword));

router.post('/settings/unlink/:provider', isLoggedIn, catchAsync(controller.unlinkProvider));

router.get('/delete-account', isLoggedIn, catchAsync(controller.deleteAccountForm));
router.post('/delete-account', isLoggedIn, catchAsync(controller.deleteAccount));

module.exports = router;
