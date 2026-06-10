const EndUser = require('../../models/endUser');
const { ApiError } = require('../../utils/apiError');

const crypto = require('crypto');

// EMAILS
const { sendPasswordResetEmail } = require('../../services/emailService');


// PASSWORDS RULES
const { validatePassword } = require('../../validators/password');
const { PASSWORD_RULES_MESSAGE } = require('../../constants/passwordRules');

// verify Email.
module.exports.verifyEmail = async (req, res) => {
    const { token, appId } = req.query;
    console.log(req.query);
  
    if (!token || !appId) {
      throw new ApiError(
        400,
        'INVALID_VERIFICATION_LINK',
        'Invalid verification link'
      );
    }
  
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  
    const user = await EndUser.findOne({
      app: appId,
      isEmailVerified : false,
      emailVerificationToken : hashedToken
    });
  
    if (!user) {
      throw new ApiError(
        400,
        'TOKEN_EXPIRED',
        'Verification link is invalid or expired'
      );
    }
  
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
  
    await user.save();
  
    res.status(200).json({
      message: 'Email verified successfully'
    });
  };
  
  /* Forgotten Password */
  module.exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    const app = req.appClient;
  
    if (!email) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Email is required'
      );
    }
  
    const user = await EndUser.findOne({
      app: app._id,
      email,
      isEmailVerified: true
    });
  
    if (!user) {
      return res.status(200).json({
        message: 'Email Not Found'
      });
    }
    
    const resetToken = user.generatePasswordResetToken();
    await user.save();
  
    const resetUrl = `${process.env.BASE_URL}/api/auth/reset-password?token=${resetToken}&appId=${app._id}`;
  
    await sendPasswordResetEmail(
      user.email,
      app.name,
      resetUrl
    );
  
    res.status(200).json({
      message: 'If that email exists, a reset link has been sent'
    });
  };
  
  /* Reset Password */
  module.exports.resetPassword = async (req, res) => {
    const {  password } = req.body;
    const {token, appId} = req.query
  
    if (!token || !appId || !password) {
      throw new ApiError(
        400,
        'VALIDATION_ERROR',
        'Token, appId and password are required'
      );
    };
  
    if (!validatePassword(password)) {
      throw new ApiError(
        400,
        'WEAK_PASSWORD',
        PASSWORD_RULES_MESSAGE
      );
    }
  
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');
  
    const user = await EndUser.findOne({
      app: appId,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+passwordHash');
  
    if (!user) {
      throw new ApiError(
        400,
        'INVALID_TOKEN',
        'Reset token is invalid or expired'
      );
    }
  
    await user.setPassword(password);
  
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion += 1; 
  
    await user.save();
  
    res.status(200).json({
      message: 'Password reset successful'
    });
  };
  
  
  // Disable Account.
  
  module.exports.disableAccount = async (req, res) => {
    const user = req.endUser;
  
    if (!user.isActive) {
      throw new ApiError(
        400,
        'ACCOUNT_ALREADY_DISABLED',
        'Account is already disabled'
      );
    }
  
    user.isActive = false;
    user.disabledAt = new Date();
    user.disabledReason = 'User requested';
  
    await user.save();
  
    res.status(200).json({
      success: true,
      message: 'Account disabled successfully'
    });
  };
  
  
  // =======================
  // RE-ENABLE ACCOUNT
  // =======================
  module.exports.reenableAccount = async (req, res) => {
    const user = req.endUser;
  
    if (user.isActive) {
      throw new ApiError(
        400,
        'ACCOUNT_ALREADY_ACTIVE',
        'Account is already active'
      );
    }
  
    user.isActive = true;
    user.disabledAt = null;
    user.disabledReason = null;
  
    // Force re-login everywhere
    user.tokenVersion += 1;
  
    await user.save();
  
    res.status(200).json({
      success: true,
      message: 'Account re-enabled successfully. Please log in again.'
    });
  };

// =======================
// ME/PROFILE PAGE
// =======================

  module.exports.me = async (req, res) => {
    try {
      const user = req.endUser; 
  
      if (!user) {
        return res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Authentication required'
        });
      }
  
      if (!user.isActive) {
        return res.status(403).json({
          error: 'ACCOUNT_DISABLED',
          message: 'This account has been disabled'
        });
      }
  
      return res.status(200).json({
        id: user._id,
        email: user.email,
        app : user.app,
        name: user.fullName,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
  
        // security / status
        failedLoginAttempts: user.failedLoginAttempts,
        isLocked: user.lockUntil && user.lockUntil > Date.now(),
  
        // optional SaaS metadata
        lastLoginAt: user.lastLoginAt
      });
    } catch (err) {
      console.error('GET /me error:', err);
  
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Unable to fetch profile'
      });
    }
  };
  
// =======================
// UPDATE PROFILE
// =======================
module.exports.updateProfile = async (req, res) => {
  const user = req.endUser;

  if (!user) {
    throw new ApiError(
      401,
      'UNAUTHORIZED',
      'Authentication required'
    );
  }

  const { fullName } = req.body;

  // Require at least one editable field
  if (!fullName) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'fullName is required'
    );
  }

  // No-op protection
  if (fullName === user.fullName) {
    throw new ApiError(
      400,
      'NO_CHANGES_DETECTED',
      'New fullName must be different from current value'
    );
  }

  user.fullName = fullName;
  user.updatedAt = new Date();

  await user.save();

  res.status(200).json({
    message: 'Profile updated successfully',
    user: {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      authProvider: user.authProvider,
      updatedAt: user.updatedAt,
    },
  });
};
