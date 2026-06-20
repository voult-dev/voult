const User = require('../../models/endUser');
const OAuthAccount = require('../../models/OAuthAccount');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const { createTokens } = require('../auth/createTokens');

const oAuthAccountBuilder = new SafeQueryBuilder(OAuthAccount);
const userBuilder = new SafeQueryBuilder(User);

async function handleOAuthCallback({
  provider,
  providerUserId,
  email,
  emailVerified,
  accessToken,
  refreshToken,
  state
}) {

  // 1️⃣ Check if this OAuth account already exists
  const existingOAuth = await oAuthAccountBuilder.findOne({
    provider,
    providerUserId
  });

  if (existingOAuth) {
    const user = await userBuilder.findById(existingOAuth.userId);
    return createTokens(user);
  }

  // 2️⃣ Linking flow (user already logged in)
  if (state?.intent === 'link' && state?.userId) {
    const user = await userBuilder.findById(state.userId);

    if (!user) throw new Error('USER_NOT_FOUND');

    await OAuthAccount.create({
      userId: user._id,
      provider,
      providerUserId,
      accessToken,
      refreshToken
    });

    // Update linkedProviders field
    if (!user.linkedProviders) {
      user.linkedProviders = [];
    }
    if (!user.linkedProviders.includes(provider)) {
      user.linkedProviders.push(provider);
      await user.save();
    }

    return { linked: true };
  }

  // 3️⃣ No OAuth found → check email
  if (email) {
    const userByEmail = await userBuilder.findOne({ email });

    if (userByEmail && emailVerified) {
      await OAuthAccount.create({
        userId: userByEmail._id,
        provider,
        providerUserId,
        accessToken,
        refreshToken
      });

      // Update linkedProviders field
      if (!userByEmail.linkedProviders) {
        userByEmail.linkedProviders = [];
      }
      if (!userByEmail.linkedProviders.includes(provider)) {
        userByEmail.linkedProviders.push(provider);
        await userByEmail.save();
      }

      return createTokens(userByEmail);
    }
  }

  // 4️⃣ Create new user
  const newUser = await User.create({
    email,
    emailVerified: emailVerified || false
  });

  await OAuthAccount.create({
    userId: newUser._id,
    provider,
    providerUserId,
    accessToken,
    refreshToken
  });

  // Update linkedProviders field for new user
  if (!newUser.linkedProviders) {
    newUser.linkedProviders = [];
  }
  if (!newUser.linkedProviders.includes(provider)) {
    newUser.linkedProviders.push(provider);
    await newUser.save();
  }

  return createTokens(newUser);
}

module.exports = handleOAuthCallback;