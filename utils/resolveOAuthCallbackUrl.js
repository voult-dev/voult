const { originalURL } = require('passport-oauth2/lib/utils');

/** Developer login / link OAuth paths (must match Google/GitHub console entries). */
const PATHS = {
  google: {
    login: '/auth/google/callback',
    link: '/auth/google/link/callback',
  },
  github: {
    login: '/auth/github/callback',
    link: '/auth/github/link/callback',
  },
};

function getBaseUrl() {
  return (process.env.BASE_URL || '').trim().replace(/\/$/, '');
}

function isLocalHost(host) {
  if (!host) return false;
  const hostname = host.split(':')[0].toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function requestOrigin(req) {
  const host = req.get('host') || req.headers?.host;
  if (!host) return null;

  const trustProxy = req.app?.get?.('trust proxy');
  const forwardedProto = (req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const tls =
    req.secure ||
    req.connection?.encrypted ||
    (trustProxy && forwardedProto === 'https');
  const protocol = tls ? 'https' : 'http';
  return `${protocol}://${host}`;
}

/**
 * Canonical redirect URI for this OAuth flow.
 * - localhost: derive from the request (http://localhost:3000/...)
 * - production: use BASE_URL (matches Google Console — your .env has https://www.voult.dev)
 */
function resolveOAuthCallbackUrl(req, relativePath) {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  const host = req.get('host') || req.headers?.host || '';
  if (isLocalHost(host)) {
    const origin = requestOrigin(req);
    if (origin) return `${origin}${path}`;
  }

  const base = getBaseUrl();
  if (base) {
    return `${base}${path}`;
  }

  const origin = requestOrigin(req);
  if (origin) return `${origin}${path}`;

  return originalURL(req, { proxy: true }).replace(/\/[^/]*$/, '') + path;
}

/** Persist redirect_uri in session so authorize + token exchange use the same value. */
function stashOAuthCallbackUrl(req, callbackURL) {
  req.session.oauthCallbackUrl = callbackURL;
}

function takeOAuthCallbackUrl(req, fallbackPath) {
  const stored = req.session.oauthCallbackUrl;
  if (stored) {
    delete req.session.oauthCallbackUrl;
    return stored;
  }
  return resolveOAuthCallbackUrl(req, fallbackPath);
}

function listGoogleRedirectUris() {
  const base = getBaseUrl();
  const local = 'http://localhost:3000';
  const paths = [PATHS.google.login, PATHS.google.link];
  const uris = new Set();
  if (base) {
    paths.forEach((p) => uris.add(`${base}${p}`));
    // apex domain if BASE_URL uses www (common misconfiguration)
    try {
      const u = new URL(base);
      if (u.hostname.startsWith('www.')) {
        const apex = `${u.protocol}//${u.hostname.slice(4)}`;
        paths.forEach((p) => uris.add(`${apex}${p}`));
      }
    } catch (_) {
      /* ignore */
    }
  }
  paths.forEach((p) => uris.add(`${local}${p}`));
  return [...uris];
}

module.exports = {
  PATHS,
  getBaseUrl,
  resolveOAuthCallbackUrl,
  stashOAuthCallbackUrl,
  takeOAuthCallbackUrl,
  listGoogleRedirectUris,
};
