const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/ipAllowlist');
const requireDeveloperAppOwner = require('../../middleware/requireDeveloperAppOwner');
const { validate } = require('../../validators/validate');
const schemas = require('../../validators/api/ipAllowlist');
const catchAsync = require('../../utils/catchAsync');

router.get('/settings', requireDeveloperAppOwner, catchAsync(controller.getSettings));

router.patch(
  '/settings',
  requireDeveloperAppOwner,
  validate(schemas.updateSettingsSchema),
  catchAsync(controller.updateSettings)
);

router.get('/entries', requireDeveloperAppOwner, catchAsync(controller.listEntries));

router.post(
  '/entries',
  requireDeveloperAppOwner,
  validate(schemas.addEntrySchema),
  catchAsync(controller.addEntry)
);

router.delete('/entries/:id', requireDeveloperAppOwner, catchAsync(controller.removeEntry));

router.get('/alerts', requireDeveloperAppOwner, catchAsync(controller.listAlerts));

router.post('/alerts/:id/acknowledge', requireDeveloperAppOwner, catchAsync(controller.acknowledgeAlert));

router.get('/check-ip', requireDeveloperAppOwner, catchAsync(controller.checkCurrentIp));

module.exports = router;
