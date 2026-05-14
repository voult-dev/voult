const express = require('express');
const router = express.Router();

const controller = require('../../controllers/api/session');

const {verifyClient} = require('../../middleware/verifyClient');
const requireEndUserAuth = require('../../middleware/requireEndUserAuth');
const requireActiveEndUser = require('../../middleware/requireActiveEndUser');

const catchAsync = require('../../utils/catchAsync');

router.get('/', requireEndUserAuth, requireActiveEndUser, catchAsync(controller.listSessions));

router.get('/revoke/:sessionId', requireEndUserAuth, requireActiveEndUser, catchAsync(controller.revokeSession));

router.post('/refresh', catchAsync(controller.refresh));                                               

module.exports = router;