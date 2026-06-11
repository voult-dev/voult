const User = require('../../models/developer');
const App = require('../../models/app');

const crypto = require('crypto');
const { validatePassword } = require('../../validators/password');

module.exports.dashboard = async (req, res) => {
  console.log('[WEB USER] dashboard() - user:', req.user?.email);
  // Simple overview; detailed app management lives on /apps
  const appsCount = await App.countDocuments({
    owner: req.user._id,
    deletedAt: { $exists: false },
  });

  res.render('user/dashboard', {
    title: 'Dashboard',
    user: req.user,
    appsCount,
  });
};

module.exports.appsPage = async (req, res) => {
  console.log('[WEB USER] appsPage() - user:', req.user?.email);
  const apps = await App.find({
    owner: req.user._id,
    deletedAt: { $exists: false },
  }).sort({ createdAt: -1 });

  res.render('user/apps', {
    title: 'Apps | voult.dev',
    user: req.user,
    apps,
  });
};

module.exports.profilePage = async (req, res) => {
  console.log('[WEB USER] profilePage() - user:', req.user?.email);
  res.render('user/profile', {
    title: 'Profile | voult.dev',
    user: req.user,
  });
};

// Generate a raw token and return it (will be hashed before storing)
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash a token for storage in the database
function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

// Enter Email Form.
module.exports.forgotPasswordForm = async(req, res)=>{
    console.log('[WEB USER] forgotPasswordForm()');
    res.render('forgottenPassword/forgot-password', {title : 'Forgot Password'})
};

// Send Email to user email
module.exports.forgotPassword = async (req, res) => {
    console.log('[WEB USER] forgotPassword() - email:', req.body?.email);
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    // Prevent email enumeration
    if (!user) {
      req.flash('success', 'If an account exists, a reset link has been sent.');
      return res.redirect('/forgot-password');
    }
    
    // Generate raw token for the email link
    const rawToken = generateResetToken();
    
    // Hash the token before storing in database
    const hashedToken = hashToken(rawToken);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 30; // 30 minutes
    await user.save();
    
    // Send raw token in the email link
    const resetUrl = `${process.env.BASE_URL}/reset-password/${rawToken}`;

    const {forgottenPasswordEmail} = require('../../services/passwordResetEmail');

    await forgottenPasswordEmail(user.name, email, resetUrl);
    
    req.flash('success', `A reset link has been sent to your email. Did not see it? <a href="/forgot-password">Resend email</a>`);
    res.redirect('/login');
};

module.exports.resetPasswordForm = async (req, res) => {
    console.log('[WEB USER] resetPasswordForm() - token provided');
    // Hash the incoming token to compare with stored hashed token
    const hashedToken = hashToken(req.params.token);
    
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
  
    if (!user) {
      req.flash('error', 'Password reset token is invalid or expired');
      return res.redirect('/forgot-password');
    }
  
    res.render('forgottenPassword/reset-password', {
      title : 'Reset Password',
      token: req.params.token,
    });
  };

module.exports.resetPassword = async(req, res)=>{
    console.log('[WEB USER] resetPassword() - token:', req.params.token);
    try {
      const { password, confirmPassword } = req.body;

      // Check if passwords match
/* eslint-disable security/detect-possible-timing-attacks */
     if(password !== confirmPassword){
       req.flash('error', 'New Password and confirm password should be the same');
       return res.redirect(`/reset-password/${req.params.token}`);
     }

      // Validate password strength
      if (!validatePassword(password)) {
        req.flash('error', 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.');
        return res.redirect(`/reset-password/${req.params.token}`);
      }

      // Hash the incoming token to compare with stored hashed token
      const hashedToken = hashToken(req.params.token);

      // Find user with valid token
      const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
      });

      if (!user) {
        req.flash('error', 'Password reset token is invalid or expired');
        return res.redirect('/forgot-password');
      }

      await user.setPassword(password);

      // Clear reset token fields (security)
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      
      // Save updated user
      await user.save();
      
      req.flash('success', 'Password changed successfully. You can login with your new passwords');
      res.redirect('/login');
      
    } catch (error) {
      console.error('[WEB USER] resetPassword() ERROR:', error.message);
      req.flash('error', 'An error occurred while resetting your password. Please try again.');
      res.redirect(`/reset-password/${req.params.token}`);
    }
};
