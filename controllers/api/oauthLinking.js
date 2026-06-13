const OAuthAccount = require('../../models/OAuthAccount');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const bcrypt = require('bcrypt');
const generateProviderAuthUrl = require('../../services/oauth/generateProviderAuthUrl')

const App = require('../../models/app');

const appBuilder = new SafeQueryBuilder(App);
const oAuthAccountBuilder = new SafeQueryBuilder(OAuthAccount);

exports.startLinking = async (req, res) => {
  const { provider } = req.params;
  const user = req.endUser;

  const app = await appBuilder.findById(user.app);

  if (!app || !app.isActive) {
    return res.status(404).json({ error: 'APP_NOT_ACTIVE' });
  };

  const providerConfig = app[`${provider}OAuth`];

  if (!providerConfig || !providerConfig.enabled) {
    return res.status(403).json({
      error: 'PROVIDER_DISABLED_FOR_THIS_APP'
    });
  };

  const state = {
    intent: 'link',
    userId: user._id.toString(),
    appId: app._id.toString()
  };

  const redirectUrl = await generateProviderAuthUrl(provider, state, user.app);

  return res.json({ redirectUrl });
};

// 🔹 Get Linked Providers
exports.getLinkedProviders = async (req, res) => {
  const accounts = await oAuthAccountBuilder.find({
    userId: req.endUser._id
  }).select('provider createdAt');

  return res.json({
    providers: accounts
  });
};


// 🔹 Unlink Provider
exports.unlinkProvider = async (req, res) => {
  const { provider } = req.params;
  const user = req.endUser;

  const oauthCount = await oAuthAccountBuilder.countDocuments({
    userId: user._id
  });

  const hasPassword = !!user.passwordHash;

  if (!hasPassword && oauthCount <= 1) {
    return res.status(400).json({
      error: 'NO_AUTH_METHOD_LEFT'
    });
  }

  // Delete the OAuth account
  await oAuthAccountBuilder.deleteOne({
    userId: user._id,
    provider
  });

  // Remove provider from linkedProviders array
  if (user.linkedProviders && user.linkedProviders.includes(provider)) {
    user.linkedProviders = user.linkedProviders.filter(p => p !== provider);
    await user.save();
  }

  return res.json({ success: true });
};


// 🔹 Set Password (for social-only accounts)
exports.setPassword = async (req, res) => {
  const { password } = req.body;
  const user = req.endUser;

  if (user.passwordHash) {
    return res.status(400).json({
      error: 'PASSWORD_ALREADY_SET'
    });
  }

  const hash = await bcrypt.hash(password, 12);

  user.passwordHash = hash;
  await user.save();

  return res.json({ success: true });
};