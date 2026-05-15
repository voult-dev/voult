const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const Developer = require('../models/developer');
const { getBaseUrl } = require('../utils/oauthCallbackUrl');

passport.use(Developer.createStrategy());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${getBaseUrl()}/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase()?.trim();
    const avatar = profile.photos?.[0]?.value;

    if (!email) {
      return done(null, false, { message: 'Google did not provide an email address.' });
    }

    let developer = await Developer.findOne({ googleId });

    if (developer) {
      return done(null, developer);
    }

    developer = await Developer.findOne({ email });

    if (developer) {
      developer.googleId = googleId;
      if (!developer.avatar) developer.avatar = avatar;
      developer.isVerified = true;
      await developer.save();
      return done(null, developer);
    }

    developer = await Developer.create({
      email,
      googleId,
      avatar,
      name: profile.displayName?.trim() || email.split('@')[0],
      hasPassword: false,
      isVerified: true,
    });

    return done(null, developer);
  } catch (err) {
    return done(err, null);
  }
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: `${getBaseUrl()}/auth/github/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const githubId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase()?.trim();
    const avatar = profile.photos?.[0]?.value;

    let developer = await Developer.findOne({ githubId });
    if (developer) return done(null, developer);

    if (email) {
      developer = await Developer.findOne({ email });
      if (developer) {
        developer.githubId = githubId;
        if (!developer.avatar) developer.avatar = avatar;
        developer.isVerified = true;
        await developer.save();
        return done(null, developer);
      }
    }

    if (!email) {
      return done(null, false, { message: 'GitHub did not provide an email address.' });
    }

    developer = await Developer.create({
      email,
      githubId,
      avatar,
      name: profile.displayName?.trim() || profile.username,
      hasPassword: false,
      isVerified: true,
    });

    return done(null, developer);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((developer, done) => {
  done(null, developer.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    if (!id) return done(null, false);
    const developer = await Developer.findById(id);
    done(null, developer);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
