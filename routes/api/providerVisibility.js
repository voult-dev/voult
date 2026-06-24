const express = require('express');
const router = express.Router();
const controller = require('../../controllers/api/providerVisibility');

const catchAsync = require('../../utils/catch_async');
const { ipBasedLimiter } = require('../../middleware/advancedRateLimiting');

router.get('/:clientId', ipBasedLimiter, catchAsync(controller.getProviderVisibility));

module.exports = router;