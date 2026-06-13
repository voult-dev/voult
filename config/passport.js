const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github').Strategy;
const Developer = require('../models/developer');
const { SafeQueryBuilder } = require('../middleware/queryValidation');

const developerBuilder = new SafeQueryBuilder(Developer);

/**
 * OAuth redirect URIs must be identical on:
 *  1) authorize redirect to Google, and
 *  2) token exchange.
 *
 * Use relative paths only — passport-oauth2 resolves them from the current
 * request (protocol + host via X-Forwarded-* when proxy: true).
 *
 * Do NOT mix BASE_URL here with a relative callbackURL in authenticate():
 * /auth/google uses authenticate without overriding callback → strategy default;
 * /auth/google/callback passes relative path → if strategy used BASE_URL you'd
 * get mismatched redirect_uri and Google's token step fails.
 */
const GOOGLE_CB = '/auth/google/callback';
const GITHUB_CB = '/auth/github/callback';

passport.use(Developer.createStrategy());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: GOOGLE_CB,
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase()?.trim();
    const avatar = profile.photos?.[0]?.value;

    if (!email) {
      return done(null, false, { message: 'Google did not provide an email address.' });
    }

    let developer = await developerBuilder.findOne({ googleId });
    if (developer) {
      return done(null, developer);
    }

    developer = await developerBuilder.findOne({ email });
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
      developer = await developerBuilder.findOne({ $or: [{ email }, { googleId }] });
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
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const githubId = String(profile.id);
    const email = profile.emails?.[0]?.value?.toLowerCase()?.trim();
    const avatar = profile.photos?.[0]?.value;
    const displayName =
      profile.displayName?.trim() ||
      profile.username ||
      (email ? email.split('@')[0] : 'Developer');

    let developer = await developerBuilder.findOne({ githubId });
    if (developer) return done(null, developer);

    if (email) {
    developer = await developerBuilder.findOne({ email });
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
      developer = await developerBuilder.findOne({ $or: [{ email }, { githubId }] });
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
    const developer = await developerBuilder.findById(id);
    done(null, developer);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
