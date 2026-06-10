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
 *
 * Priority:
 *  1. If host is localhost → derive from request (http://localhost:PORT/path)
 *  2. Otherwise → always use BASE_URL (the authoritative production URL).
 *     Never fall back to passport-oauth2's originalURL() in production because
 *     it can reconstruct an http:// URL even on HTTPS deployments behind a
 *     reverse proxy, causing a redirect_uri mismatch with Google/GitHub.
 */
function resolveOAuthCallbackUrl(req, relativePath) {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  const host = req.get('host') || req.headers?.host || '';

  // On localhost always derive from the request so developers don't need BASE_URL set.
  if (isLocalHost(host)) {
    const origin = requestOrigin(req);
    if (origin) return `${origin}${path}`;
  }

  // In production (or any non-localhost host) always use BASE_URL.
  // This guarantees the URI matches what is registered in Google/GitHub consoles.
  const base = getBaseUrl();
  if (base) {
    return `${base}${path}`;
  }

  // Last-resort fallback: try to derive from the request (may still be wrong on some
  // proxy setups, but at least we tried). Log a warning so it's obvious.
  console.warn(
    '[resolveOAuthCallbackUrl] BASE_URL is not set. ' +
      'OAuth redirect URIs may be incorrect in production. ' +
      'Set BASE_URL=https://www.voult.dev in your environment.'
  );
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
  // If the session value is gone (e.g. session not persisted across redirect),
  // recompute deterministically from BASE_URL so it still matches Google Console.
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
    } catch {
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