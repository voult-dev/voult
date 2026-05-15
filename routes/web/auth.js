const express = require('express');
const router = express.Router();

const passport = require('passport');

const controller = require('../../controllers/web/auth');

const catchAsync = require('../../utils/catchAsync');

const { redirectIfLoggedIn, storeReturnTo, isLoggedIn } = require('../../middleware');

const { webAuthLimiter } = require('../../middleware/rateLimiters');

router.get('/login', redirectIfLoggedIn, controller.loginForm);

router.post('/login', 
  storeReturnTo, 
  webAuthLimiter,
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Invalid credentials. Please try again.'
  }),
  controller.login
);

router.get('/register', redirectIfLoggedIn, controller.registerForm);

router.post('/register', webAuthLimiter, catchAsync(controller.register));

router.get('/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

router.get('/auth/google/callback', controller.googleCallback);

router.get('/auth/google/link', isLoggedIn, controller.startLinkGoogle);
router.get('/auth/google/link/callback', controller.googleLinkCallback);

router.get('/auth/github',
  passport.authenticate('github', {
    scope: ['user:email'],
  })
);

router.get('/auth/github/callback', controller.githubCallback);

router.get('/auth/github/link', isLoggedIn, controller.startLinkGithub);
router.get('/auth/github/link/callback', controller.githubLinkCallback);

router.post('/logout', controller.logout);

router.get('/verify/:token', catchAsync(controller.verifyAccount));

module.exports = router;