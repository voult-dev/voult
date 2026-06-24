const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/auditLog');
const { verifyClient } = require('../../middleware/verifyClient');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const catchAsync = require('../../utils/catchAsync');

router.get('/policy', verifyClient, catchAsync(controller.getRetentionPolicy));

router.get('/summary', verifyClient, catchAsync(controller.getAppSummary));

router.get('/high-risk', verifyClient, catchAsync(controller.listHighRiskEvents));

router.get('/me', verifyClient, requireEndUserAuth, catchAsync(controller.listMyLogs));

router.get('/', verifyClient, catchAsync(controller.listAppLogs));

module.exports = router;
