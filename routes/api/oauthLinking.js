const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/oauthLinking');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');
const { csrfProtection } = require('../../middleware/csrfProtection');
const { createPerUserLimiter } = require('../../middleware/advancedRateLimiting');

const catchAsync =require('../../utils/catchAsync');

router.post(
   '/oauth/:provider/link',
   csrfProtection,
   requireEndUserAuth,
   requireActiveEndUser,
   createPerUserLimiter(15 * 60 * 1000, 5, 'Too many linking attempts. Please try again later.'),
   catchAsync(controller.startLinking)
);

router.get(
   '/me/oauth-accounts',
   requireEndUserAuth,
   requireActiveEndUser,
   createPerUserLimiter(15 * 60 * 1000, 10, 'Too many requests. Please try again later.'),
   catchAsync(controller.getLinkedProviders)
);

router.delete(
   '/me/oauth-accounts/:provider',
   csrfProtection,
   requireEndUserAuth,
   requireActiveEndUser,
   createPerUserLimiter(15 * 60 * 1000, 5, 'Too many unlinking attempts. Please try again later.'),
   catchAsync(controller.unlinkProvider)
);

router.post(
   '/me/set-password',
   csrfProtection,
   requireEndUserAuth,
   requireActiveEndUser,
   createPerUserLimiter(15 * 60 * 1000, 5, 'Too many password setting attempts. Please try again later.'),
   catchAsync(controller.setPassword)
);

module.exports = router;