const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/mfa');
const { verifyClient } = require('../../middleware/verifyClient');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');
const { validate } = require('../../validators/validate');
const schemas = require('../../validators/api/mfa');
const { mfaVerifyLimiter } = require('../../middleware/advancedRateLimiting');
const catchAsync = require('../../utils/catchAsync');

router.post(
  '/verify',
  verifyClient,
  mfaVerifyLimiter,
  validate(schemas.verifyMfaLoginSchema),
  catchAsync(controller.verifyMfaLogin)
);

router.get(
  '/status',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  catchAsync(controller.getMfaStatus)
);

router.post(
  '/setup',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  catchAsync(controller.setupMfa)
);

router.post(
  '/enable',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  validate(schemas.enableMfaSchema),
  catchAsync(controller.enableMfa)
);

router.post(
  '/disable',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  validate(schemas.disableMfaSchema),
  catchAsync(controller.disableMfa)
);

router.post(
  '/backup-codes/regenerate',
  verifyClient,
  requireEndUserAuth,
  requireActiveEndUser,
  validate(schemas.regenerateBackupCodesSchema),
  catchAsync(controller.regenerateBackupCodes)
);

module.exports = router;
