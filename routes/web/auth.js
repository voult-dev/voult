const express = require('express');
const router = express.Router();

const passport = require('passport');

const controller = require('../../controllers/web/auth');

const catchAsync = require('../../utils/catchAsync');

const { redirectIfLoggedIn, storeReturnTo, isLoggedIn } = require('../../middleware');

const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

router.get('/login', redirectIfLoggedIn, controller.loginForm);

router.post('/login', 
  storeReturnTo, 
  ipBasedLimiter,
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Invalid credentials. Please try again.'
  }),
  controller.login
);

router.get('/register', redirectIfLoggedIn, controller.registerForm);

router.post('/register', ipBasedLimiter, catchAsync(controller.register));

router.get('/auth/google', controller.startGoogle);

router.get('/auth/google/callback', controller.googleCallback);

router.get('/auth/google/link', isLoggedIn, controller.startLinkGoogle);
router.get('/auth/google/link/callback', controller.googleLinkCallback);

router.get('/auth/github', controller.startGithub);

router.get('/auth/github/callback', controller.githubCallback);

router.get('/auth/github/link', isLoggedIn, controller.startLinkGithub);
router.get('/auth/github/link/callback', controller.githubLinkCallback);

router.post('/logout', controller.logout);

router.get('/verify/:token', catchAsync(controller.verifyAccount));

// CSRF token endpoint for JavaScript clients
router.get('/csrf-token', (req, res) => {
  res.json({ token: req.csrfToken() });
});

module.exports = router;