const express = require('express');
const router = express.Router();

const { verifyClientIdOnly } = require('../../middleware/verifyClient');

const { csrfProtection } = require('../../middleware/csrfProtection');

const catchAsync = require('../../utils/catchAsync');

const controller = require('../../controllers/api/github');

router.post('/register', csrfProtection, verifyClientIdOnly, catchAsync(controller.githubRegister));

router.post('/login', csrfProtection, verifyClientIdOnly, catchAsync(controller.githubLogin));

router.get('/profile', verifyClientIdOnly, catchAsync(controller.githubProfile));

module.exports = router;