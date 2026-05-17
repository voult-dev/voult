const express = require('express');
const router = express.Router();

const { verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const catchAsync = require('../../utils/catchAsync');

const controller = require('../../controllers/api/apple');

router.post('/auth/apple/register', csrfProtection, verifyClientIdOnly, catchAsync(controller.appleRegister));

router.post('/auth/apple/login', csrfProtection,  verifyClientIdOnly, catchAsync(controller.appleLogin));

module.exports = router;