const express = require('express');
const router = express.Router();

const controller = require('../../controllers/web/user');
const catchAsync = require('../../utils/catchAsync');

const { csrfProtection } = require('../../middleware/csrfProtection');

const { isLoggedIn } = require('../../middleware');

const { webAuthLimiter } = require('../../middleware/rateLimiters')

router.get('/dashboard', isLoggedIn, catchAsync(controller.dashboard));

router.get('/apps', isLoggedIn, catchAsync(controller.appsPage));

router.get('/profile', isLoggedIn, catchAsync(controller.profilePage));

router.get('/forgot-password', controller.forgotPasswordForm);

router.post('/forgot-password', csrfProtection, webAuthLimiter, catchAsync(controller.forgotPassword));

router.get('/reset-password/:token', catchAsync(controller.resetPasswordForm));

router.post('/reset-password/:token', csrfProtection, webAuthLimiter, catchAsync(controller.resetPassword));

module.exports = router;