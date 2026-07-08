const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/webauthn');
const { verifyClient } = require('../../middleware/verifyClient');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');
const { validate } = require('../../validators/validate');
const schemas = require('../../validators/api/webauthn');
const { ipAuthLimiter, createPerUserLimiter } = require('../../middleware/advancedRateLimiting');
const catchAsync = require('../../utils/catchAsync');

router.get('/compatibility', verifyClient, catchAsync(controller.getCompatibility));

router.post(
  '/register/options',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  validate(schemas.registrationOptionsSchema),
  catchAsync(controller.registrationOptions)
);

router.post(
  '/register/verify',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  createPerUserLimiter(15 * 60 * 1000, 10, 'Too many passkey registration attempts. Try again later.'),
  validate(schemas.registrationVerifySchema),
  catchAsync(controller.registrationVerify)
);

router.post(
  '/login/options',
  verifyClient,
  ipAuthLimiter,
  validate(schemas.authenticationOptionsSchema),
  catchAsync(controller.authenticationOptions)
);

router.post(
  '/login/verify',
  verifyClient,
  ipAuthLimiter,
  validate(schemas.authenticationVerifySchema),
  catchAsync(controller.authenticationVerify)
);

router.get(
  '/credentials',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  catchAsync(controller.listCredentials)
);

router.patch(
  '/credentials/:id',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  validate(schemas.updateCredentialSchema),
  catchAsync(controller.updateCredential)
);

router.delete(
  '/credentials/:id',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  catchAsync(controller.deleteCredential)
);

module.exports = router;
