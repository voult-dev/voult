const LEGACY_OAUTH_SUNSET = '2026-12-31';

function legacyOAuthDeprecation(req, res, next) {
  res.set('Deprecation', LEGACY_OAUTH_SUNSET);
  res.set(
    'Warning',
    `299 - "Legacy OAuth routes are deprecated. Use /api/auth/{provider}/* instead. Sunset: ${LEGACY_OAUTH_SUNSET}"`
  );
  res.set('Link', '</docs>; rel="deprecation"; type="text/html"');
  next();
}

module.exports = {
  legacyOAuthDeprecation,
  LEGACY_OAUTH_SUNSET
};
