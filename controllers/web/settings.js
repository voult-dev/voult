const crypto = require('crypto');
const User = require('../../models/developer');
const App = require('../../models/app');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const { sendEmailChangeVerification } = require('../../services/emailService');

const userBuilder = new SafeQueryBuilder(User);
const appBuilder = new SafeQueryBuilder(App);

// Developer Settings Page.
module.exports.settingsPage = (req, res) => {
  const user = req.user;
  res.render('user/settings', { title: 'Settings | voult.dev', user });
};

// Update profile (name, username only).
module.exports.updateSettings = async (req, res) => {
  const { name, username } = req.body;
  const user = await userBuilder.findById(req.user._id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/settings');
  }
  if (name != null && name.trim() !== '') user.name = name.trim();
  if (username != null) user.username = username.trim() || undefined;
  await user.save();
  req.flash('success', 'Profile updated.');
  res.redirect('/settings');
};

// Request email change: set pending email, send verification to new address.
module.exports.requestEmailChange = async (req, res) => {
  const { newEmail } = req.body;
  const newEmailNorm = (newEmail || '').toLowerCase().trim();
  if (!newEmailNorm) {
    req.flash('error', 'Email is required');
    return res.redirect('/settings');
  }
  const user = await userBuilder.findById(req.user._id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/settings');
  }
  if (user.email.toLowerCase() === newEmailNorm) {
    req.flash('error', 'New email is the same as current email');
    return res.redirect('/settings');
  }
  const existing = await userBuilder.findOne({ email: newEmailNorm });
  if (existing) {
    req.flash('error', 'That email is already in use');
    return res.redirect('/settings');
  }
  const token = crypto.randomBytes(32).toString('hex');
  user.pendingEmail = newEmailNorm;
  user.pendingEmailToken = crypto.createHash('sha256').update(token).digest('hex');
  user.pendingEmailTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  const verifyUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/settings/verify-email/${token}`;
  await sendEmailChangeVerification(newEmailNorm, user.name, verifyUrl);
  req.flash('success', 'Verification email sent. Check your new inbox to confirm.');
  res.redirect('/settings');
};

// Verify new email (link in email).
module.exports.verifyNewEmail = async (req, res) => {
  const rawToken = req.params.token;
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const user = await userBuilder.findOne({
    pendingEmailToken: hashedToken,
    pendingEmailTokenExpires: { $gt: Date.now() },
  });
  if (!user) {
    req.flash('error', 'Link invalid or expired');
    return res.redirect('/settings');
  }
  user.email = user.pendingEmail;
  user.pendingEmail = undefined;
  user.pendingEmailToken = undefined;
  user.pendingEmailTokenExpires = undefined;
  await user.save();
  req.flash('success', 'Email updated successfully.');
  res.redirect('/settings');
};

// Set password (OAuth users who have not set a password yet).
module.exports.setPassword = async (req, res) => {
  const { password, confirmPassword } = req.body;
  const user = await userBuilder.findById(req.user._id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/settings');
  }
  if (user.hasPassword) {
    req.flash('error', 'You already have a password. Use "Change password" instead.');
    return res.redirect('/settings');
  }
  if (!password || !confirmPassword) {
    req.flash('error', 'Please fill in both password fields');
    return res.redirect('/settings');
  }
  /* eslint-disable security/detect-possible-timing-attacks */
   if (password !== confirmPassword) {
     req.flash('error', 'Passwords do not match');
     return res.redirect('/settings');
   }
  if (password.length < 8) {
    req.flash('error', 'Password must be at least 8 characters');
    return res.redirect('/settings');
  }
  await user.setPassword(password);
  user.hasPassword = true;
  await user.save();
  req.flash('success', 'Password set. You can now sign in with email and password.');
  res.redirect('/settings');
};

// Change password (requires current password).
module.exports.changePassword = async (req, res) => {
  const { currentPassword, password, confirmPassword } = req.body;
  const user = await userBuilder.findById(req.user._id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/settings');
  }
  if (user.hasPassword === false) {
    req.flash('error', 'Set a password first using the "Set password" form.');
    return res.redirect('/settings');
  }
  const { error } = await user.authenticate(currentPassword);
  if (error) {
    req.flash('error', 'Current password is incorrect');
    return res.redirect('/settings');
  }
  if (!password || !confirmPassword) {
    req.flash('error', 'Please fill in new password and confirmation');
    return res.redirect('/settings');
  }
  /* eslint-disable security/detect-possible-timing-attacks */
   if (password !== confirmPassword) {
     req.flash('error', 'New passwords do not match');
     return res.redirect('/settings');
   }
  if (password.length < 8) {
    req.flash('error', 'Password must be at least 8 characters');
    return res.redirect('/settings');
  }
  await user.setPassword(password);
  await user.save();
  req.flash('success', 'Password updated successfully.');
  res.redirect('/settings');
};

// Unlink OAuth provider (must keep at least one sign-in method).
module.exports.unlinkProvider = async (req, res) => {
  const { provider } = req.params;
  if (provider !== 'google' && provider !== 'github') {
    req.flash('error', 'Invalid provider');
    return res.redirect('/settings');
  }

  const user = await userBuilder.findById(req.user._id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/settings');
  }

  const hasPassword = user.hasPassword !== false;
  const hasGoogle = !!user.googleId;
  const hasGithub = !!user.githubId;

  if (provider === 'google' && !user.googleId) {
    req.flash('error', 'Google is not linked to your account.');
    return res.redirect('/settings');
  }
  if (provider === 'github' && !user.githubId) {
    req.flash('error', 'GitHub is not linked to your account.');
    return res.redirect('/settings');
  }

  const otherMethods = hasPassword + (provider === 'google' ? hasGithub : hasGoogle);
  if (otherMethods < 1) {
    req.flash('error', 'You must keep at least one sign-in method. Set a password or link another provider first.');
    return res.redirect('/settings');
  }

  if (provider === 'google') user.googleId = undefined;
  else user.githubId = undefined;
  await user.save();

  req.flash('success', provider === 'google' ? 'Google unlinked.' : 'GitHub unlinked.');
  res.redirect('/settings');
};

module.exports.deleteAccountForm = async (req, res) => {
  const user = await userBuilder.findById(req.user._id);
  if (!user) {
    req.flash('error', 'User not found');
    return res.redirect('/dashboard');
  }
  res.render('user/enterPassword', {
    title: 'Delete account | voult.dev',
    user,
    hasPassword: user.hasPassword,
  });
};

module.exports.deleteAccount = async (req, res, next) => {
  try {
    const { password, confirmDelete } = req.body;
    const user = await userBuilder.findById(req.user._id);

    if (!user) {
      req.flash('error', 'User does not exist');
      return res.redirect('/dashboard');
    }

    if (user.hasPassword) {
      const { error } = await user.authenticate(password);
      if (error) {
        req.flash('error', 'Incorrect password');
        return res.redirect('/delete-account');
      }
    } else {
      if (confirmDelete !== 'yes') {
        req.flash('error', 'Please confirm by checking the box.');
        return res.redirect('/delete-account');
      }
    }

    req.logout(async (err) => {
      if (err) return next(err);
      await appBuilder.deleteMany({ owner: user._id });
      await userBuilder.findByIdAndDelete(user._id);
      req.flash('success', 'Account deleted successfully');
      res.redirect('/');
    });
  } catch (err) {
    next(err);
  }
};
