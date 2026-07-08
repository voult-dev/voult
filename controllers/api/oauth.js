// controllers/oauthController.js

const OAuthAccount = require('../../models/OAuthAccount');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const User = require('../../models/endUser');
const App = require('../../models/app');
const {createToken} = require('../../utils/createTokens');
const exchangeCodeForToken = require('../../utils/exchangeCodeForToken');
const getProviderProfile = require('../../utils/getProviderProfile');
const generateProviderAuthUrl = require('../../services/oauth/generateProviderAuthUrl');

const oAuthAccountBuilder = new SafeQueryBuilder(OAuthAccount);
const userBuilder = new SafeQueryBuilder(User);
const appBuilder = new SafeQueryBuilder(App);

const { LEGACY_OAUTH_SUNSET } = require('../../middleware/deprecationNotice');

const DEPRECATION_NOTICE = {
  deprecated: true,
  migrationGuide: 'Use /api/auth/{provider}/* instead of /api/{provider}/*',
  sunsetDate: LEGACY_OAUTH_SUNSET
};

function withDeprecation(payload) {
  return { ...payload, _deprecation: DEPRECATION_NOTICE };
}

function decodeState(state) {
  return JSON.parse(
    Buffer.from(state, 'base64url').toString()
  );
}

// Generate OAuth authorization URL
exports.generateAuthUrl = async (req, res) => {
  try {
    const { provider } = req.params;
    const { intent, redirectUri } = req.body;
    
    // Validate required parameters
    if (!intent || !redirectUri) {
      return res.status(400).json({ 
        error: 'MISSING_PARAMETERS',
        message: 'intent and redirectUri are required' 
      });
    }

    // Validate intent
    const validIntents = ['register', 'login', 'link'];
    if (!validIntents.includes(intent)) {
      return res.status(400).json({ 
        error: 'INVALID_INTENT',
        message: 'intent must be one of: register, login, link' 
      });
    }

    // Get app ID from request (could be from header, query, or body)
    const appId = req.headers['x-app-id'] || req.query.appId || req.body.appId;
    
    if (!appId) {
      return res.status(400).json({ 
        error: 'MISSING_APP_ID',
        message: 'App ID is required. Provide via X-App-ID header, query param, or body.' 
      });
    }

    // For link intent, userId is required
    if (intent === 'link' && !req.body.userId) {
      return res.status(400).json({ 
        error: 'MISSING_USER_ID',
        message: 'userId is required for link intent' 
      });
    }

    // Build state object
    const stateObj = {
      intent,
      appId,
      redirectUri,
      ...(intent === 'link' && { userId: req.body.userId })
    };

    // Generate the authorization URL
    const authUrl = await generateProviderAuthUrl(provider, stateObj, appId);

    return res.json(withDeprecation({
      authUrl,
      provider,
      intent,
      expiresInSeconds: 600
    }));

  } catch (error) {
    console.error('Error generating auth URL:', error);
    
    if (error.message === 'INVALID_PROVIDER') {
      return res.status(400).json({ 
        error: 'INVALID_PROVIDER',
        message: 'Unsupported OAuth provider' 
      });
    }
    
    if (error.message === 'GOOGLE_NOT_ENABLED' || 
        error.message === 'FACEBOOK_NOT_ENABLED' ||
        error.message === 'LINKEDIN_NOT_ENABLED' ||
        error.message === 'MICROSOFT_NOT_ENABLED' ||
        error.message === 'APPLE_NOT_ENABLED' ||
        error.message === 'GITHUB_NOT_ENABLED') {
      return res.status(403).json({ 
        error: 'PROVIDER_NOT_ENABLED',
        message: 'OAuth provider is not enabled for this app' 
      });
    }

    return res.status(500).json({ 
      error: 'INTERNAL_ERROR',
      message: 'Failed to generate authorization URL' 
    });
  }
};

exports.handleCallback = async (req, res) => {
  try {
    const { provider } = req.params;
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'INVALID_OAUTH_CALLBACK' });
    }

    const decodedState = decodeState(state);
    const { intent, userId, appId } = decodedState;

    // 1️⃣ Fetch app with secrets and check provider enablement
    const app = await appBuilder.findById(appId).select('+googleOAuth.clientSecret +githubOAuth.clientSecret +facebookOAuth.appSecret +linkedinOAuth.clientSecret +appleOAuth.privateKey +microsoftOAuth.clientSecret');
    
    if (!app || !app.isActive) {
      return res.status(404).json({ error: 'APP_NOT_ACTIVE' });
    }

    const providerConfig = app[`${provider}OAuth`];
    if (!providerConfig || !providerConfig.enabled) {
      return res.status(403).json({ error: 'PROVIDER_DISABLED_FOR_THIS_APP' });
    }

    // 2️⃣ Exchange code for tokens using app credentials
    const tokenResponse = await exchangeCodeForToken(provider, code, app);

    // 3️⃣ Fetch provider profile
    const profile = await getProviderProfile(provider, tokenResponse);

    const providerUserId = profile.id;
    const email = profile.email;

    if (!providerUserId) {
      return res.status(400).json({ error: 'PROVIDER_ID_NOT_FOUND' });
    }

    // Check if this provider account already exists
    const existingOAuth = await oAuthAccountBuilder.findOne({
      provider,
      providerUserId
    });

    // ===============================
    // INTENT: LINK
    // ===============================
    if (intent === 'link') {

      if (!userId) {
        return res.status(400).json({ error: 'INVALID_LINK_STATE' });
      }

      if (existingOAuth && existingOAuth.user.toString() !== userId) {
        return res.status(409).json({
          error: 'PROVIDER_ALREADY_LINKED_TO_ANOTHER_USER'
        });
      }

      await oAuthAccountBuilder.findOneAndUpdate(
        { user: userId, provider, app: app._id },
        {
          providerUserId,
          profile: {
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar,
            raw: profile.raw
          },
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : null
        },
        { upsert: true, new: true }
      );

      // Track linked provider on the end user document as well
      await userBuilder.findByIdAndUpdate(
        userId,
        { $addToSet: { linkedProviders: provider } }
      );

      return res.json(withDeprecation({ message: 'ACCOUNT_LINKED_SUCCESSFULLY' }));
    }

    // ===============================
    // INTENT: LOGIN
    // ===============================
    if (intent === 'login') {

      if (!existingOAuth) {
        return res.status(404).json({ error: 'ACCOUNT_NOT_REGISTERED' });
      }

      const user = await userBuilder.findById(existingOAuth.user);

      const token = createToken(user);

      return res.json(withDeprecation({ token }));
    }

    // ===============================
    // INTENT: REGISTER
    // ===============================
    if (intent === 'register') {

      if (existingOAuth) {
        return res.status(409).json({
          error: 'ACCOUNT_ALREADY_EXISTS'
        });
      }

      if (!email) {
        return res.status(400).json({
          error: 'EMAIL_REQUIRED_FOR_REGISTRATION'
        });
      }

      let user = await userBuilder.findOne({ email });

      if (!user) {
        user = await User.create({
          email,
          name: profile.name
        });
      }

      await OAuthAccount.create({
        user: user._id,
        app: app._id,
        provider,
        providerUserId,
        profile: {
          email: profile.email,
          name: profile.name,
          avatar: profile.avatar,
          raw: profile.raw
        },
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token
      });

      const token = createToken(user);

      return res.json(withDeprecation({ token }));
    }

    return res.status(400).json({ error: 'INVALID_INTENT' });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'OAUTH_CALLBACK_FAILED' });
  }
};
