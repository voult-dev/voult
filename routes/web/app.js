const express = require('express');
const router = express.Router();

const controller = require('../../controllers/web/app');

const catchAsync = require('../../utils/catchAsync');

const { validate } = require('../../validators/validate');
const appSchemas = require('../../validators/web/app');

const {isLoggedIn} = require('../../middleware');
const { csrfProtection } = require('../../middleware/csrfProtection');
router.use(isLoggedIn);

router.get('/new', controller.newForm);

router.post('/', validate(appSchemas.createAppSchema), catchAsync(controller.newApp));

router.post('/:id/toggle', csrfProtection, catchAsync(controller.toggleApp));

router.get('/:id', catchAsync(controller.manage));

router.delete('/:id', csrfProtection, catchAsync(controller.deleteApp));

router.get('/:id/edit', catchAsync(controller.editForm));

router.put('/:id',  csrfProtection, validate(appSchemas.createAppSchema), catchAsync(controller.updateApp));

router.post('/:id/rotate-secret', csrfProtection,catchAsync(controller.rotateClientSecret));

router.get('/:id/google-oauth', catchAsync(controller.getGoogleOAuth));

router.post('/:id/google-oauth', csrfProtection, catchAsync(controller.saveGoogleOAuth));

router.get('/:id/github-oauth', catchAsync(controller.getGithubOAuth));

router.post('/:id/github-oauth', csrfProtection, catchAsync(controller.saveGithubOAuth));

router.post('/app/:id/update-google-oauth',  csrfProtection,catchAsync(controller.updateGoogleOAuth));

router.post('/app/:id/update-github-oauth',  csrfProtection, catchAsync(controller.updateGithubOAuth));

router.get('/:id/facebook-oauth', catchAsync(controller.getFacebookOAuth));

router.post('/:id/facebook-oauth', csrfProtection, catchAsync(controller.saveFacebookOAuth));

router.post('/:id/update-facebook-oauth',  csrfProtection, catchAsync(controller.updateFacebookOAuth));

router.get('/:id/linkedin-oauth', catchAsync(controller.getLinkeldinOAuth));

router.get('/:id/apple-oauth', catchAsync(controller.getAppleOAuth));

router.post('/:id/linkedin-oauth',  csrfProtection, catchAsync(controller.saveLinkedinOAuth));

router.post('/:id/update-linkedin-oauth', csrfProtection, catchAsync(controller.updateLinkedinOAuth));

router.post('/:id/apple-oauth', csrfProtection, catchAsync(controller.saveAppleOAuth));

router.post('/:id/update-apple-oauth', csrfProtection, catchAsync(controller.updateAppleOAuth));

router.get('/:id/microsoft-oauth', catchAsync(controller.getMicrosoftOAuth));

router.post('/:id/microsoft-oauth', csrfProtection, catchAsync(controller.saveMicrosoftOAuth));

router.post('/:id/update-microsoft-oauth', csrfProtection, catchAsync(controller.updateMicrosoftOAuth));

module.exports = router;