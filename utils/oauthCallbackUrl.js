function getBaseUrl() {
  return (process.env.BASE_URL || 'http://localhost:3000').trim().replace(/\/$/, '');
}

function isLocalHost(host) {
  if (!host) return false;
  const hostname = host.split(':')[0].toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * OAuth redirect URI must match the host that started the flow.
 * On localhost, use the request host so Google redirects back to the dev server.
 * In production, use BASE_URL (e.g. https://www.voult.dev).
 */
function getOAuthCallbackUrl(req, path) {
  const host = req.get('host');
  if (isLocalHost(host)) {
    const proto =
      req.secure || req.headers['x-forwarded-proto'] === 'https'
        ? 'https'
        : 'http';
    return `${proto}://${host}${path}`;
  }
  return `${getBaseUrl()}${path}`;
}

module.exports = { getBaseUrl, getOAuthCallbackUrl, isLocalHost };
