/**
 * WHAT WORKS (Magic Link):
 * Generates a token and send it in a URL via email.
 * Validates that the token is valid and not expired.
 * 
 * TODO:
 * Find the user in the db. If user is not found return error.
 * Generate JWT tokens for authentication
 * Log the user into their app.
 */

const { magicLinkEmail } = require('../../services/magicLinkEmail');
const MagicLinkToken = require('../../models/MagicLinkToken');
const EndUser = require('../../models/endUser');
const App = require('../../models/app');
const { createTokens } = require('../../utils/createTokens');
const crypto = require('crypto');
const { ApiError } = require('../../utils/apiError');

/**
 * Send Magic Link
 * POST /api/send-magic-link
 * Body: { email: string, clientId: string, redirectUri: string }
 * 
 * The redirectUri is the developer's app URL where the user should be sent
 * after clicking the magic link. The developer's app will receive the token
 * and then call /api/validate-magic-link to get JWT tokens.
 */
module.exports.sendLink = async (req, res) => {
  const { email, clientId, redirectUri } = req.body;

  // Validate input
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A valid email address is required');
  }

  if (!clientId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Client ID (appId) is required');
  }

  if (!redirectUri) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Redirect URI (developer app URL) is required');
  }

  // Validate redirectUri format (must be a valid URL)
  try {
    new URL(redirectUri);
  } catch {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid redirect URI format. Must be a valid URL.');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Find the app
  const app = await App.findOne({ clientId, deletedAt: { $exists: false } });
  if (!app || !app.isActive) {
    throw new ApiError(404, 'APP_NOT_FOUND', 'App not found or inactive');
  }

  // Redirect URI allowlist enforcement: only allow redirectUri configured for this app
  // This matches the semantics of validateCallbackUrl
  if (!Array.isArray(app.allowedCallbackUrls) || !app.allowedCallbackUrls.includes(redirectUri)) {
    throw new ApiError(
      400,
      'INVALID_CALLBACK_URL',
      'Redirect URI is not allowlisted for this app'
    );
  }

  // Generate a secure random token
  const rawToken = crypto.randomBytes(32).toString('hex');

  // Set token expiration (10 minutes)
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  // Create and save the token record
  const tokenDoc = new MagicLinkToken({
    email: normalizedEmail,
    app: app._id,
    tokenHash: MagicLinkToken.hashToken(rawToken),
    expiresAt,
    redirectUri
  });

  await tokenDoc.save();

  // Build the magic link URL pointing to the developer's app
  const magicLinkURL = `${redirectUri}?token=${rawToken}`;

  // Send the email
  await magicLinkEmail(normalizedEmail, magicLinkURL);

  res.status(200).json({
    success: true,
    message: 'Magic link sent successfully. Please check your email.'
  });
};


/**
 * Validate Magic Link Token and Authenticate User
 * POST /api/validate-magic-link
 * Body: { token: string }
 */
module.exports.validateToken = async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Token is required');
  }

  // Atomically claim the token so it can’t be used twice under concurrency
  const tokenDoc = await MagicLinkToken.claimValidToken(token);

  if (!tokenDoc) {
    throw new ApiError(400, 'INVALID_OR_EXPIRED_TOKEN', 'Invalid or expired token');
  }

  // Find end user for this app + email
  const user = await EndUser.findOne({
    email: tokenDoc.email,
    app: tokenDoc.app,
    deletedAt: null
  });

  if (!user) {
    throw new ApiError(
      404,
      'USER_NOT_FOUND',
      'No account found with this email. Please register first.'
    );
  }

  // Ensure account is active
  if (!user.isActive) {
    throw new ApiError(403, 'ACCOUNT_DISABLED', 'Account is disabled');
  }

  // Mark token as used already done by claim.
  // Update user's last login and email verification
  user.lastLoginAt = new Date();
  user.isEmailVerified = true;
  await user.save();

  // Generate JWT tokens
  const { accessToken, refreshToken } = await createTokens({
    user,
    app: tokenDoc.app,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    message: 'Authentication successful',
    data: {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        isEmailVerified: user.isEmailVerified
      }
    }
  });
};

