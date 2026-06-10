// utils/exchangeCodeForToken.js

const axios = require('axios');

module.exports = async function exchangeCodeForToken(provider, code, app) {

  switch (provider) {

    case 'google':
      if (!app || !app.googleOAuth) {
        throw new Error('GOOGLE_OAUTH_NOT_CONFIGURED_FOR_APP');
      }
      return (
        await axios.post('https://oauth2.googleapis.com/token', {
          code,
          client_id: app.googleOAuth.clientId,
          client_secret: app.googleOAuth.clientSecret,
          redirect_uri: app.googleOAuth.redirectUri,
          grant_type: 'authorization_code'
        })
      ).data;

    case 'github':
      if (!app || !app.githubOAuth) {
        throw new Error('GITHUB_OAUTH_NOT_CONFIGURED_FOR_APP');
      }
      return (
        await axios.post(
          'https://github.com/login/oauth/access_token',
          {
            code,
            client_id: app.githubOAuth.clientId,
            client_secret: app.githubOAuth.clientSecret
          },
          { headers: { Accept: 'application/json' } }
        )
      ).data;

    case 'facebook':
      if (!app || !app.facebookOAuth) {
        throw new Error('FACEBOOK_OAUTH_NOT_CONFIGURED_FOR_APP');
      }
      return (
        await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', {
          code,
          client_id: app.facebookOAuth.appId,
          client_secret: app.facebookOAuth.appSecret,
          redirect_uri: app.facebookOAuth.redirectUri
        })
      ).data;

    case 'linkedin':
      if (!app || !app.linkedinOAuth) {
        throw new Error('LINKEDIN_OAUTH_NOT_CONFIGURED_FOR_APP');
      }
      return (
        await axios.post('https://www.linkedin.com/oauth/v2/accessToken', {
          grant_type: 'authorization_code',
          code,
          client_id: app.linkedinOAuth.clientId,
          client_secret: app.linkedinOAuth.clientSecret,
          redirect_uri: app.linkedinOAuth.redirectUri
        })
      ).data;

    case 'microsoft': {
      if (!app || !app.microsoftOAuth) {
        throw new Error('MICROSOFT_OAUTH_NOT_CONFIGURED_FOR_APP');
      }
      const tenant = app.microsoftOAuth.tenantId || 'common';
      return (
        await axios.post(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
          grant_type: 'authorization_code',
          code,
          client_id: app.microsoftOAuth.clientId,
          client_secret: app.microsoftOAuth.clientSecret,
          redirect_uri: app.microsoftOAuth.redirectUri
        })
      ).data;
    }

    case 'apple': {
      if (!app || !app.appleOAuth) {
        throw new Error('APPLE_OAUTH_NOT_CONFIGURED_FOR_APP');
      }
      // Apple requires JWT client secret
      const jwtSecret = generateAppleJWT(app.appleOAuth);
      return (
        await axios.post('https://appleid.apple.com/auth/token', {
          grant_type: 'authorization_code',
          code,
          client_id: app.appleOAuth.clientId,
          client_secret: jwtSecret,
          redirect_uri: app.appleOAuth.redirectUri
        })
      ).data;
    }

    default:
      throw new Error('TOKEN_EXCHANGE_NOT_IMPLEMENTED');
  }
};

function generateAppleJWT(appleConfig) {
  const jwt = require('jsonwebtoken');
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    iss: appleConfig.teamId,
    iat: now,
    exp: now + 3600,
    aud: 'https://appleid.apple.com',
    sub: appleConfig.clientId
  };

  return jwt.sign(payload, appleConfig.privateKey, {
    algorithm: 'ES256',
    keyid: appleConfig.keyId
  });
}
