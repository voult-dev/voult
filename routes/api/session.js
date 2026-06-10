const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/session');

const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');
const { csrfProtection } = require('../../middleware/csrfProtection');


const catchAsync = require('../../utils/catchAsync');

router.get('/', requireEndUserAuth, requireActiveEndUser, catchAsync(controller.listSessions));

router.get('/revoke/:sessionId', requireEndUserAuth, requireActiveEndUser, catchAsync(controller.revokeSession));

router.post('/refresh', csrfProtection, catchAsync(controller.refresh));                                               

module.exports = router;