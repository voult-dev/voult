const User = require('../../models/developer');
const passport = require('passport');
const { welcomeEmail } = require('../../services/emailService');
const crypto = require('crypto');

const { getOAuthCallbackUrl } = require('../../utils/oauthCallbackUrl');

function oauthErrorMessage(strategy, err) {
  if (err.code === 'invalid_grant') {
    return 'Sign-in expired or was already used. Please try Google again.';
  }
  if (/redirect_uri/i.test(err.message || '')) {
    return 'OAuth redirect URL mismatch. Add this app\'s callback URL in Google Cloud Console.';
  }
  console.error(`${strategy} OAuth error:`, err);
  return 'Sign-in failed. Please try again.';
}

function oauthCallback(strategy, req, res, next) {
  const callbackURL = getOAuthCallbackUrl(
    req,
    `/auth/${strategy}/callback`
  );

  passport.authenticate(strategy, { callbackURL }, (err, user, info) => {
    if (err) {
      console.error(`${strategy} OAuth callback URL:`, callbackURL);
      req.flash('error', oauthErrorMessage(strategy, err));
      return res.redirect('/login');
    }
    if (!user) {
      const message = info?.message || 'Sign-in was cancelled or failed.';
      req.flash('error', message);
      return res.redirect('/login');
    }
    req.login(user, async (loginErr) => {
      if (loginErr) {
        console.error(`${strategy} session error:`, loginErr);
        req.flash('error', 'Could not sign you in. Please try again.');
        return res.redirect('/login');
      }
      try {
        user.lastLoginAt = new Date();
        await user.save();
        req.flash('success', 'Welcome back');
        res.redirect(res.locals.returnTo || '/');
      } catch (saveErr) {
        next(saveErr);
      }
    });
  })(req, res, next);
}

module.exports.loginForm = (req, res)=>{
    res.render('auth/login', {title : "Login Page"})
};

module.exports.login = async (req, res) => {
    req.user.lastLoginAt = new Date();
    await req.user.save();

    req.flash('success', 'Welcome back');
    const returnUrl = res.locals.returnTo || '/';
    res.redirect(returnUrl);
};

module.exports.registerForm = (req, res)=>{
    res.render('auth/register', {title : 'Register Form'});
};

module.exports.register =  async (req, res) => {
    try {
      const { email, name, password, username } = req.body;
  
      if (!email || !name || !password) {
        req.flash('error', 'All fields are required');
        return res.redirect('/register');
      };

      const verifyToken = crypto.randomBytes(32).toString('hex');

      const user = new User({
        name,
        email,
        username,
        verifyToken,
        verifyTokenExpires: Date.now() + 1000 * 60 * 60 * 24 // 24h
      });


      const verifyUrl = `${process.env.BASE_URL}/verify/${verifyToken}`
  
      await User.register(user, password);
  
      await user.save();

      await welcomeEmail(user.email, user.name, verifyUrl);
  
      req.login(user, err => {
        if (err) throw err;
        req.flash('success', 'Account created successfully');
        res.redirect('/');
      });
  
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/register');
    }
  };

module.exports.googleCallback = (req, res, next) => oauthCallback('google', req, res, next);

module.exports.githubCallback = (req, res, next) => oauthCallback('github', req, res, next);

module.exports.logout = (req, res, next) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }

    req.flash('success', 'You have logged out successfully');
    res.redirect('/');
  });
};

module.exports.verifyAccount = async (req, res) => {
  const user = await User.findOne({
    verifyToken: req.params.token,
    verifyTokenExpires: { $gt: Date.now() }
  });

  if (!user) {
    req.flash('error', 'Verification link is invalid or expired.');
    return res.redirect('/login');
  }

  user.isVerified = true;
  user.verifyToken = undefined;
  user.verifyTokenExpires = undefined;

  await user.save();

  req.flash('success', 'Your account has been verified. You can now log in.');
  res.redirect('/login');
};

// ---- Link OAuth providers to developer account (must be logged in) ----

module.exports.startLinkGoogle = (req, res, next) => {
  req.session.linkingUserId = req.user._id.toString();
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    callbackURL: getOAuthCallbackUrl(req, '/auth/google/link/callback'),
  })(req, res, next);
};

module.exports.googleLinkCallback = (req, res, next) => {
  const targetId = req.session.linkingUserId;
  if (targetId) delete req.session.linkingUserId;

  passport.authenticate('google', {
    callbackURL: getOAuthCallbackUrl(req, '/auth/google/link/callback'),
    failureRedirect: '/settings',
  }, async (err, user, info) => {
    if (err) {
      req.flash('error', 'Could not link Google account.');
      return res.redirect('/settings');
    }
    if (!user) {
      req.flash('error', 'Google sign-in was cancelled or failed.');
      return res.redirect('/settings');
    }
    if (!targetId) {
      req.flash('error', 'Link session expired. Please try again.');
      return res.redirect('/settings');
    }

    const target = await User.findById(targetId);
    if (!target) {
      req.flash('error', 'Account not found.');
      return res.redirect('/settings');
    }

    target.googleId = user.googleId;
    if (!target.avatar && user.avatar) target.avatar = user.avatar;
    await target.save();

    if (user._id.toString() !== targetId) {
      await User.findByIdAndUpdate(user._id, { $unset: { googleId: 1 } });
      req.login(target, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.flash('success', 'Google account linked.');
        res.redirect('/settings');
      });
    } else {
      req.flash('success', 'Google account linked.');
      res.redirect('/settings');
    }
  })(req, res, next);
};

module.exports.startLinkGithub = (req, res, next) => {
  req.session.linkingUserId = req.user._id.toString();
  passport.authenticate('github', {
    scope: ['user:email'],
    callbackURL: getOAuthCallbackUrl(req, '/auth/github/link/callback'),
  })(req, res, next);
};

module.exports.githubLinkCallback = (req, res, next) => {
  const targetId = req.session.linkingUserId;
  if (targetId) delete req.session.linkingUserId;

  passport.authenticate('github', {
    callbackURL: getOAuthCallbackUrl(req, '/auth/github/link/callback'),
    failureRedirect: '/settings',
  }, async (err, user, info) => {
    if (err) {
      req.flash('error', 'Could not link GitHub account.');
      return res.redirect('/settings');
    }
    if (!user) {
      req.flash('error', 'GitHub sign-in was cancelled or failed.');
      return res.redirect('/settings');
    }
    if (!targetId) {
      req.flash('error', 'Link session expired. Please try again.');
      return res.redirect('/settings');
    }

    const target = await User.findById(targetId);
    if (!target) {
      req.flash('error', 'Account not found.');
      return res.redirect('/settings');
    }

    target.githubId = user.githubId;
    if (!target.avatar && user.avatar) target.avatar = user.avatar;
    await target.save();

    if (user._id.toString() !== targetId) {
      await User.findByIdAndUpdate(user._id, { $unset: { githubId: 1 } });
      req.login(target, (loginErr) => {
        if (loginErr) return next(loginErr);
        req.flash('success', 'GitHub account linked.');
        res.redirect('/settings');
      });
    } else {
      req.flash('success', 'GitHub account linked.');
      res.redirect('/settings');
    }
  })(req, res, next);
};