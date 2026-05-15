const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const Developer = require('../models/developer');

/**
 * Relative URLs: passport-oauth2 resolves them against the current request origin
 * (see passport-oauth2/lib/strategy.js). That keeps redirect_uri aligned with
 * whichever host the developer used (localhost, www, apex, Render URL).
 */
const GOOGLE_CB = '/auth/google/callback';
const GITHUB_CB = '/auth/github/callback';

passport.use(Developer.createStrategy());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: GOOGLE_CB,
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

    try {
      developer = await Developer.create({
        email,
        googleId,
        avatar,
        name: profile.displayName?.trim() || email.split('@')[0],
        hasPassword: false,
        isVerified: true,
      });
    } catch (createErr) {
      if (createErr.code !== 11000) {
        return done(createErr);
      }
      developer = await Developer.findOne({ $or: [{ email }, { googleId }] });
      if (!developer) {
        return done(createErr);
      }
      if (!developer.googleId) {
        developer.googleId = googleId;
        if (!developer.avatar) developer.avatar = avatar;
        developer.isVerified = true;
        await developer.save();
      }
    }

    return done(null, developer);
  } catch (err) {
    return done(err);
  }
}));

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: GITHUB_CB,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const githubId = String(profile.id);
    const email = profile.emails?.[0]?.value?.toLowerCase()?.trim();
    const avatar = profile.photos?.[0]?.value;
    const displayName =
      profile.displayName?.trim() ||
      profile.username ||
      (email ? email.split('@')[0] : 'Developer');

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

    try {
      developer = await Developer.create({
        email,
        githubId,
        avatar,
        name: displayName,
        hasPassword: false,
        isVerified: true,
      });
    } catch (createErr) {
      if (createErr.code !== 11000) {
        return done(createErr);
      }
      developer = await Developer.findOne({ $or: [{ email }, { githubId }] });
      if (!developer) {
        return done(createErr);
      }
      if (!developer.githubId) {
        developer.githubId = githubId;
        if (!developer.avatar) developer.avatar = avatar;
        developer.isVerified = true;
        await developer.save();
      }
    }

    return done(null, developer);
  } catch (err) {
    return done(err);
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
