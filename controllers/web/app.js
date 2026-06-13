const App = require('../../models/app');
const OAuthAccount = require('../../models/OAuthAccount');
const User = require('../../models/endUser');
const RefreshToken = require('../../models/refreshToken');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const { ApiError } = require('../../utils/apiError');

const appBuilder = new SafeQueryBuilder(App);
const oAuthAccountBuilder = new SafeQueryBuilder(OAuthAccount);
const userBuilder = new SafeQueryBuilder(User);
const refreshTokenBuilder = new SafeQueryBuilder(RefreshToken);

module.exports.newForm = (req, res)=>{
    res.render('app/new', {title : 'New App'});
};

module.exports.newApp = async (req, res) => {
  const { name, description, callbackUrl } = req.body;

  const app = new App({
    name,
    description,
    owner: req.user._id,
    isActive: true,
    allowedCallbackUrls: callbackUrl ? [callbackUrl] : [],
  });

  app.generateClientId();

  const rawClientSecret = app.generateClientSecret();

  await app.save();

  res.render('app/created', {
    app,
    clientSecret: rawClientSecret,
    title : `${app.name} client secret`
  });
};

module.exports.rotateClientSecret = async (req, res) => {
  const { id } = req.params;

  // Find app and ensure it belongs to the logged-in developer
  const app = await appBuilder.findOne({
    _id: id,
    owner: req.user._id,
    deletedAt: { $exists: false }
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  }

  // Generate new secret
  const newClientSecret = app.generateClientSecret();

  await app.save();

  // Show it ONCE
  res.render('app/rotated', {
    app,
    clientSecret: newClientSecret,
    title : 'Rotate Client Secret'
  });
};


module.exports.manage = async(req, res)=>{
    const app = await appBuilder.findById(req.params.id);
    res.render('app/manage', {app, title : `Manage ${app.name}`})
};

module.exports.deleteApp = async (req, res) => {
    const { id } = req.params;
  
    const app = await appBuilder.findById(id);
  
    if (!app) {
      req.flash('error', 'App not found');
      return res.redirect('/dashboard');
    }
  

    if (!app.owner.equals(req.user._id)) {
      req.flash('error', 'You are not authorized to delete this app');
      return res.redirect('/dashboard');
    }

    app.isActive = false;
    app.deletedAt = new Date();
  
    await app.save();
  
    req.flash('success', 'App deleted successfully');
    res.redirect('/dashboard');
  };

module.exports.editForm = async(req, res)=>{
    const app = await appBuilder.findById(req.params.id);
    res.render('app/edit', {app, title : `Edit ${app.name}`})
};

module.exports.updateApp = async (req, res) => {
    const { id } = req.params;
    const { name, description, callbackUrl, isActive } = req.body;
  
    const app = await appBuilder.findById(id);
  
    if (!app) {
      req.flash('error', 'App not found');
      return res.redirect('/dashboard');
    }

    if (!app.owner.equals(req.user._id)) {
      req.flash('error', 'You are not authorized to update this app');
      return res.redirect('/dashboard');
    }
  
    app.name = name;
    app.description = description;
    if (callbackUrl !== undefined && callbackUrl !== '') {
      app.allowedCallbackUrls = [callbackUrl];
    }
    app.isActive = isActive === 'true';
  
    await app.save();
  
    req.flash('success', 'App updated successfully');
    res.redirect(`/app/${app._id}`);
  };

  module.exports.toggleApp = async (req, res) => {
    const { id } = req.params;
  
    const app = await appBuilder.findById(id);
  
    if (!app) {
      req.flash('error', 'App not found');
      return res.redirect('/dashboard');
    }
  
    if (!app.owner.equals(req.user._id)) {
      req.flash('error', 'You are not authorized to modify this app');
      return res.redirect('/dashboard');
    }
  
    app.isActive = !app.isActive;
    await app.save();
  
    req.flash(
      'success',
      `App ${app.isActive ? 'enabled' : 'disabled'} successfully`
    );
  
    res.redirect(`/app/${app._id}`);
};

module.exports.getGoogleOAuth = async (req, res) => {
  const app = await appBuilder.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  }

  res.render('app/google/googleOAuthForm', {
    app,
    title: 'Configure Google OAuth',
  });
};


module.exports.saveGoogleOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, redirectUri } = req.body;

  const app = await appBuilder.findOne({
    _id: id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  }

  if (!clientId || !clientSecret || !redirectUri) {
    req.flash('error', 'All Google OAuth fields are required');
    return res.redirect(`/app/${id}/google-oauth`);
  }

  // Check if any users are already linked to Google OAuth
  const userIds = (await userBuilder.find({ app: id }).select('_id').lean()).map(user => user._id);
  const linkedUsers = await oAuthAccountBuilder.countDocuments({
    provider: 'google',
    user: { $in: userIds }
  });

  if (linkedUsers > 0) {
    req.flash('error', 'Cannot disable Google OAuth while users have linked accounts. Unlink accounts first.');
    return res.redirect(`/app/${id}`);
  }

  app.googleOAuth = {
    enabled: true,
    clientId,
    clientSecret,
    redirectUri,
  };

  await app.save();

  req.flash('success', 'Google OAuth configured successfully');
  res.redirect(`/app/${app._id}`);
};

module.exports.getGithubOAuth = async (req, res)=>{
  const app = await appBuilder.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  }

  res.render('app/github/githubOAuthForm', {
    app,
    title: 'Configure Gitub OAuth',
  });
};

module.exports.saveGithubOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, redirectUri } = req.body;

  const app = await appBuilder.findById(id);

  if (!app) {
    throw new ApiError(404, 'APP_NOT_FOUND', 'Application not found');
  }

  // Initialize config object if missing
  if (!app.githubOAuth) {
    app.githubOAuth = {};
  }

  /* ---------------- Validation ---------------- */
  if (!clientId || !redirectUri) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Client ID and Redirect URI are required'
    );
  }

  /* ---------------- Persist Config ---------------- */
  app.githubOAuth.enabled =  'true';

  app.githubOAuth.clientId = clientId.trim();
  app.githubOAuth.redirectUri = redirectUri.trim();

  // Only overwrite secret if explicitly provided
  if (clientSecret && clientSecret.trim().length > 0) {
    app.githubOAuth.clientSecret = clientSecret.trim();
  }

  await app.save();

  /* ---------------- UX Response ---------------- */
  req.flash('success', 'GitHub OAuth settings saved successfully');
  res.redirect(`/app/${id}/settings`);
};

/* ---------------- GOOGLE OAUTH ---------------- */

module.exports.updateGoogleOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, redirectUri, enabled } = req.body;

  const app = await appBuilder.findById(id);
  if (!app) throw new ApiError(404, 'APP_NOT_FOUND', 'App not found');

  // Check if disabling Google OAuth while users have linked accounts
  if (enabled === 'false' && app.googleOAuth?.enabled) {
    const userIds = (await userBuilder.find({ app: id }).select('_id').lean()).map(user => user._id);
    const linkedUsers = await oAuthAccountBuilder.countDocuments({
      provider: 'google',
      user: { $in: userIds }
    });

    if (linkedUsers > 0) {
      req.flash('error', 'Cannot disable Google OAuth while users have linked accounts. Unlink accounts first.');
      return res.redirect(`/app/${id}`);
    }
  }

  const previousRedirectUri = app.googleOAuth?.redirectUri;

  app.googleOAuth = {
    enabled: enabled === 'true',
    clientId,
    redirectUri,
    clientSecret: clientSecret
      ? clientSecret
      : app.googleOAuth?.clientSecret 
  };

  await app.save();

  if (
    previousRedirectUri &&
    redirectUri &&
    previousRedirectUri !== redirectUri
  ) {
    await refreshTokenBuilder.updateMany(
      { app: app._id, provider: 'google' },
      { revokedAt: new Date() }
    );
  }

  req.flash('success', 'Google OAuth settings updated');
  res.redirect(`/app/${id}`);
};

/* ---------------- GITHUB OAUTH ---------------- */

module.exports.updateGithubOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, redirectUri, enabled } = req.body;

  const app = await appBuilder.findById(id);
  if (!app) throw new ApiError(404, 'APP_NOT_FOUND', 'App not found');

  const previousRedirectUri = app.githubOAuth?.redirectUri;

  app.githubOAuth = {
    enabled: enabled === 'true',
    clientId,
    redirectUri,
    clientSecret: clientSecret
      ? clientSecret
      : app.githubOAuth?.clientSecret
  };

  await app.save();

  if (
    previousRedirectUri &&
    redirectUri &&
    previousRedirectUri !== redirectUri
  ) {
    await refreshTokenBuilder.updateMany(
      { app: app._id, provider: 'github' },
      { revokedAt: new Date() }
    );
  }

  req.flash('success', 'GitHub OAuth settings updated');
  res.redirect(`/app/${id}/settings`);
};

module.exports.getFacebookOAuth = async (req, res) => {
  const app = await appBuilder.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  };

  res.render('app/facebook/oauthForm', {
    app,
    title: 'Configure Facebook OAuth',
  });
};

module.exports.saveFacebookOAuth = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { enabled, appId: fbAppId, appSecret, redirectUri } = req.body;

    // Always fetch with secret explicitly selected
    const app = await appBuilder.findById(id).select('+facebookOAuth.appSecret');

    if (!app) {
      return res.status(404).json({ error: 'App not found' });
    }

    // Ensure container exists
    if (!app.facebookOAuth) {
      app.facebookOAuth = {};
    }

    // Enable / disable
    if (enabled !== undefined) {
      app.facebookOAuth.enabled = enabled === 'true';
    }

    // Update App ID
    if (fbAppId) {
      app.facebookOAuth.appId = fbAppId.trim();
    }

    // Update redirect URI
    if (redirectUri) {
      app.facebookOAuth.redirectUri = redirectUri.trim();
    }

    // Update secret ONLY if explicitly provided
    if (appSecret && appSecret.trim().length > 0) {
      app.facebookOAuth.appSecret = appSecret.trim();
    }

    await app.save();

    req.flash('success', 'Facebook Credentials Added Successfully')
    return res.redirect(`/app/${id}`);
  } catch (err) {
    next(err);
  }
};

module.exports.updateFacebookOAuth = async (req, res) => {
  const { id } = req.params;
  const { appId, appSecret, redirectUri, enabled } = req.body;

  /* ---------- Fetch app WITH secret ---------- */
  const app = await appBuilder.findById(id).select('+facebookOAuth.appSecret');

  if (!app) {
    throw new ApiError(404, 'APP_NOT_FOUND', 'Application not found');
  }

  /* ---------- Initialize object if missing ---------- */
  if (!app.facebookOAuth) {
    app.facebookOAuth = {};
  }

  /* ---------- Enable / Disable ---------- */
  app.facebookOAuth.enabled = enabled === 'true';

  /* ---------- App ID ---------- */
  if (appId) {
    app.facebookOAuth.appId = appId.trim();
  }

  /* ---------- Redirect URI ---------- */
  if (redirectUri) {
    app.facebookOAuth.redirectUri = redirectUri.trim();
  }

  /* ---------- Secret rotation (ONLY if provided) ---------- */
  if (appSecret && appSecret.trim().length > 0) {
    app.facebookOAuth.appSecret = appSecret.trim();
  }

  /* ---------- Validation (only when enabled) ---------- */
  if (app.facebookOAuth.enabled) {
    if (
      !app.facebookOAuth.appId ||
      !app.facebookOAuth.appSecret ||
      !app.facebookOAuth.redirectUri
    ) {
      throw new ApiError(
        400,
        'INVALID_FACEBOOK_OAUTH_CONFIG',
        'App ID, App Secret, and Redirect URI are required when Facebook OAuth is enabled'
      );
    }
  }

  await app.save();
  req.flash('success', 'Facebook Credentials Uodated Successsfully')
  return res.redirect(`/app/${id}`);
};

module.exports.getLinkeldinOAuth = async (req, res) => {
  const app = await appBuilder.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  };

  res.render('app/linkedin/oauthForm', {
    app,
    title: 'Configure LinkedIn OAuth',
  });
};

module.exports.saveLinkedinOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, redirectUri } = req.body;

  const app = await appBuilder.findOne({
    _id: id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  }

  if (!clientId || !clientSecret || !redirectUri) {
    req.flash('error', 'All LinkedIn OAuth fields are required');
    return res.redirect(`/app/${id}/linkedin-oauth`);
  };

  app.linkedinOAuth = {
    enabled: true,
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    redirectUri: redirectUri.trim(),
  };

  await app.save();

  req.flash('success', 'LinkedIn OAuth configured successfully');
  res.redirect(`/app/${app._id}`);
};

module.exports.updateLinkedinOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, redirectUri, enabled } = req.body;

  const app = await appBuilder.findById(id).select('+linkedinOAuth.clientSecret');
  if (!app) throw new ApiError(404, 'APP_NOT_FOUND', 'App not found');

  if (!app.owner.equals(req.user._id)) {
    req.flash('error', 'You are not authorized to update this app');
    return res.redirect('/dashboard');
  }

  if (!app.linkedinOAuth) {
    app.linkedinOAuth = {};
  }

  app.linkedinOAuth.enabled = enabled === 'true';
  app.linkedinOAuth.clientId = (clientId || '').trim();
  app.linkedinOAuth.redirectUri = (redirectUri || '').trim();
  if (clientSecret && clientSecret.trim().length > 0) {
    app.linkedinOAuth.clientSecret = clientSecret.trim();
  }

  await app.save();

  req.flash('success', 'LinkedIn OAuth settings updated');
  res.redirect(`/app/${id}`);
};


module.exports.getAppleOAuth = async (req, res) => {
  const app = await appBuilder.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  };

  res.render('app/apple/oauthForm', {
    app,
    title: 'Configure Apple OAuth',
  });
};

module.exports.saveAppleOAuth = async (req, res) => {
  const { id } = req.params;
  const { teamId, clientId, keyId, privateKey, redirectUri } = req.body;

  const app = await appBuilder.findOne({
    _id: id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  }

  if (!teamId || !clientId || !keyId || !privateKey || !redirectUri) {
    req.flash('error', 'All Apple OAuth fields are required');
    return res.redirect(`/app/${id}/apple-oauth`);
  }

  app.appleOAuth = {
    enabled: true,
    teamId: teamId.trim(),
    clientId: clientId.trim(),
    keyId: keyId.trim(),
    privateKey: privateKey.trim(),
    redirectUri: redirectUri.trim(),
  };

  await app.save();

  req.flash('success', 'Apple OAuth configured successfully');
  res.redirect(`/app/${app._id}`);
};

module.exports.updateAppleOAuth = async (req, res) => {
  const { id } = req.params;
  const { teamId, clientId, keyId, privateKey, redirectUri, enabled } = req.body;

  const app = await appBuilder.findById(id).select('+appleOAuth.privateKey');
  if (!app) throw new ApiError(404, 'APP_NOT_FOUND', 'App not found');

  if (!app.owner.equals(req.user._id)) {
    req.flash('error', 'You are not authorized to update this app');
    return res.redirect('/dashboard');
  }

  if (!app.appleOAuth) {
    app.appleOAuth = {};
  }

  app.appleOAuth.enabled = enabled === 'true';
  app.appleOAuth.teamId = (teamId || '').trim();
  app.appleOAuth.clientId = (clientId || '').trim();
  app.appleOAuth.keyId = (keyId || '').trim();
  app.appleOAuth.redirectUri = (redirectUri || '').trim();
  
  if (privateKey && privateKey.trim().length > 0) {
    app.appleOAuth.privateKey = privateKey.trim();
  }

  await app.save();

  req.flash('success', 'Apple OAuth settings updated');
  res.redirect(`/app/${id}`);
};

module.exports.getMicrosoftOAuth = async (req, res) => {
  const app = await appBuilder.findOne({
    _id: req.params.id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  };

  res.render('app/microsoft/oauthForm', {
    app,
    title: 'Configure Microsoft OAuth',
  });
};

module.exports.saveMicrosoftOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, tenantId, redirectUri } = req.body;

  const app = await appBuilder.findOne({
    _id: id,
    owner: req.user._id,
  });

  if (!app) {
    req.flash('error', 'App not found or access denied');
    return res.redirect('/dashboard');
  }

  if (!clientId || !clientSecret || !redirectUri) {
    req.flash('error', 'All Microsoft OAuth fields are required');
    return res.redirect(`/app/${id}/microsoft-oauth`);
  }

  app.microsoftOAuth = {
    enabled: true,
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    tenantId: tenantId ? tenantId.trim() : 'common',
    redirectUri: redirectUri.trim(),
  };

  await app.save();

  req.flash('success', 'Microsoft OAuth configured successfully');
  res.redirect(`/app/${app._id}`);
};

module.exports.updateMicrosoftOAuth = async (req, res) => {
  const { id } = req.params;
  const { clientId, clientSecret, tenantId, redirectUri, enabled } = req.body;

  const app = await appBuilder.findById(id).select('+microsoftOAuth.clientSecret');
  if (!app) throw new ApiError(404, 'APP_NOT_FOUND', 'App not found');

  if (!app.owner.equals(req.user._id)) {
    req.flash('error', 'You are not authorized to update this app');
    return res.redirect('/dashboard');
  }

  if (!app.microsoftOAuth) {
    app.microsoftOAuth = {};
  }

  app.microsoftOAuth.enabled = enabled === 'true';
  app.microsoftOAuth.clientId = (clientId || '').trim();
  app.microsoftOAuth.tenantId = (tenantId || 'common').trim();
  app.microsoftOAuth.redirectUri = (redirectUri || '').trim();
  
  if (clientSecret && clientSecret.trim().length > 0) {
    app.microsoftOAuth.clientSecret = clientSecret.trim();
  }

  await app.save();

  req.flash('success', 'Microsoft OAuth settings updated');
  res.redirect(`/app/${id}`);
};

