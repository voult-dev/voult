const express = require('express');
const router = express.Router();

//   Web Routes (sessions + EJS)
const webAuthRoutes = require('./web/auth');
const webUserRoutes = require('./web/user');
const webAppRoutes = require('./web/app');
const developerSettingsRoutes = require('./web/settings');

// API Routes
const apiAuthRoutes = require('./api/auth');
const mfaRoutes = require('./api/mfa');
const webauthnRoutes = require('./api/webauthn');
const sessionRoutes = require('./api/session');
const apiUserRoutes = require('./api/user');
const apiGoogle  = require('./api/google');
const apiGithub = require('./api/github');
const apiFacebook = require('./api/facebook');
const apiLinkedin = require('./api/linkedin');
const apiMicorsoft  = require('./api/microsoft');
const oauthLinking = require('./api/oauthLinking');
const oauth = require('./api/oauth');
const auditLogRoutes = require('./api/auditLog');
const userOAuthAccounts = require('./api/userOAuthAccounts');
const magicLinkRoutes = require('./api/magicLink');

// Mount Web Routes
router.use('/', webAuthRoutes);
router.use('/', webUserRoutes);
router.use('/app', webAppRoutes);
router.use('/', developerSettingsRoutes);

const { verifyEndUserJWT } = require('../middleware/verifyEndUserJWT');
router.use('/api', verifyEndUserJWT);

// Mount API Routes
router.use('/api', oauth);
router.use('/api/auth', apiAuthRoutes);
router.use('/api/auth/mfa', mfaRoutes);
router.use('/api/auth/webauthn', webauthnRoutes);
router.use('/api/audit-logs', auditLogRoutes);
router.use('/api/sessions', sessionRoutes);
router.use('/api/user', apiUserRoutes);
router.use('/api/auth/google', apiGoogle);
router.use('/api/auth/github', apiGithub);
router.use('/api/auth/facebook', apiFacebook);
router.use('/api/auth/linkedin', apiLinkedin);
router.use('/api/auth/microsoft', apiMicorsoft);
router.use('/api', oauthLinking);
router.use('/api', magicLinkRoutes);
router.use('/api', userOAuthAccounts);
// router.use('/api/health', healthRoutes);

router.use(require('../middleware/apiErrorHandler'));

// Home Page Route
router.get('/', (req, res) => {
    if (req.isAuthenticated()) {
      return res.render('home/home-logged-in', {
        user: req.user,
        title: 'voult.dev',
      });
    }
  
    res.render('home/home-guest', {
      title: 'voult.dev',
    });
  });

module.exports = router;
