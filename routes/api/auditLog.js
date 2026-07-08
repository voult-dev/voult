const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/auditLog');
const { verifyClient } = require('../../middleware/verifyClient');
const requireDeveloperAppOwner = require('../../middleware/requireDeveloperAppOwner');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const catchAsync = require('../../utils/catchAsync');

router.get('/policy', requireDeveloperAppOwner, catchAsync(controller.getRetentionPolicy));

router.get('/summary', requireDeveloperAppOwner, catchAsync(controller.getAppSummary));

router.get('/high-risk', requireDeveloperAppOwner, catchAsync(controller.listHighRiskEvents));

router.get('/me', verifyClient, requireEndUserAuth, catchAsync(controller.listMyLogs));

router.get('/', requireDeveloperAppOwner, catchAsync(controller.listAppLogs));

module.exports = router;
