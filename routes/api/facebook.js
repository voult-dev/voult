const express = require('express');
const router = express.Router();

const { verifyClientIdOnly } = require('../../middleware/verifyClient');
const { csrfProtection } = require('../../middleware/csrfProtection');

const catchAsync = require('../../utils/catchAsync');

const controller = require('../../controllers/api/facebook');

router.post('/register', csrfProtection, verifyClientIdOnly, catchAsync(controller.facebookRegister));

router.post('/login', csrfProtection, verifyClientIdOnly, catchAsync(controller.facebookLogin));

module.exports = router;