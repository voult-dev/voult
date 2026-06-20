const querystring = require('querystring');
const App = require('../../models/app');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');

const appBuilder = new SafeQueryBuilder(App);

function encodeState(stateObj) {
  return Buffer
    .from(JSON.stringify(stateObj))
    .toString('base64url');
}

module.exports = async function generateProviderAuthUrl(provider, state, appId) {

  const encodedState = encodeState(state);
  const app = await appBuilder.findById(appId);

  switch (provider) {

    case 'google': {
      if (app.googleOAuth?.enabled === false) {
        throw new Error('GOOGLE_NOT_ENABLED');
      };

      const params = querystring.stringify({
        client_id: app.googleOAuth?.clientId,
        redirect_uri: app.googleOAuth?.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
        state: encodedState
      });

      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    case 'facebook': {
      if (app.facebookOAuth?.enabled === false) {
        throw new Error('FACEBOOK_NOT_ENABLED');
      }

      const params = querystring.stringify({
        client_id: app.facebookOAuth?.clientId,
        redirect_uri: app.facebookOAuth?.redirectUri,
        response_type: 'code',
        scope: 'email,public_profile',
        state: encodedState
      });

      return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
    };

    case 'linkedin': {
      if (app.linkedinOAuth?.enabled === false) {
        throw new Error('LINKEDIN_NOT_ENABLED');
      }
      
      const params = querystring.stringify({
        response_type: 'code',
        client_id: app.linkedinOAuth?.clientId,
        redirect_uri: app.linkedinOAuth?.redirectUri,
        scope: 'openid profile email',
        state: encodedState
      });

      return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
    }

    case 'microsoft': {
      if (app.microsoftOAuth?.enabled === false) {
        throw new Error('MICROSOFT_NOT_ENABLED');
      }

      const tenant = app.microsoftOAuth.tenantId || 'common';

      const params = querystring.stringify({
        client_id: app.microsoftOAuth?.clientId,
        response_type: 'code',
        redirect_uri: app.microsoftOAuth?.redirectUri,
        response_mode: 'query',
        scope: 'openid profile email',
        state: encodedState
      });

      return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params}`;
    }

    case 'apple': {
      if (app.appleOAuth?.enabled === false) {
        throw new Error('APPLE_NOT_ENABLED');
      }

      const params = querystring.stringify({
        client_id: app.appleOAuth?.clientId,
        redirect_uri: app.appleOAuth?.redirectUri,
        response_type: 'code id_token',
        response_mode: 'form_post',
        scope: 'name email',
        state: encodedState
      });

      return `https://appleid.apple.com/auth/authorize?${params}`;
    }

    case 'github': {
      if (app.githubOAuth?.enabled === false) {
        throw new Error('GITHUB_NOT_ENABLED');
      };

      const params = querystring.stringify({
        client_id: app.githubOAuth?.clientId,
        redirect_uri: app.githubOAuth?.redirectUri,
        scope: 'read:user user:email',
        allow_signup: 'true',
        state: encodedState
      });

      return `https://github.com/login/oauth/authorize?${params}`;
    }

    default:
      throw new Error('INVALID_PROVIDER');
  }
};