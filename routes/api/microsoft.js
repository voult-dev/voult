const express = require('express');
const router = express.Router();

const { verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const catchAsync = require('../../utils/catchAsync');

const controller = require('../../controllers/api/microsoft');

router.post('/auth/microsoft/register',csrfProtection, verifyClientIdOnly, catchAsync(controller.microsoftRegister));

router.post('/auth/microsoft/login', csrfProtection, verifyClientIdOnly, catchAsync(controller.microsoftLogin));

module.exports = router;