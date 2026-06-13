const OAuthAccount = require('../../models/OAuthAccount');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');

const oAuthAccountBuilder = new SafeQueryBuilder(OAuthAccount);

exports.getLinkedProviders = async (req, res) => {
  try {
    const accounts = await oAuthAccountBuilder.find({
      user: req.endUser._id,
      app: req.endUser.app,
      deletedAt: null
    }).select('provider profile createdAt');

    const linkedProviders = accounts.map(account => ({
      provider: account.provider,
      avatar: account.profile?.avatar,
      name: account.profile?.name,
      email: account.profile?.email,
      linkedAt: account.createdAt
    }));

    return res.json({
      success: true,
      providers: linkedProviders
    });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'FETCH_LINKED_PROVIDERS_FAILED' });
  }
};

exports.unlinkProvider = async (req, res) => {
  try {
    const { provider } = req.params;
    const user = req.endUser;

    // Check if user has password or other OAuth accounts
    const oauthCount = await oAuthAccountBuilder.countDocuments({
      user: user._id,
      app: user.app,
      deletedAt: null
    });

    const hasPassword = !!user.passwordHash;

    if (!hasPassword && oauthCount <= 1) {
      return res.status(400).json({
        error: 'NO_AUTH_METHOD_LEFT'
      });
    }

    // Soft delete the OAuth account
    await oAuthAccountBuilder.findOneAndUpdate(
      {
        user: user._id,
        app: user.app,
        provider
      },
      {
        deletedAt: new Date()
      }
    );

    return res.json({ 
      success: true,
      message: 'Provider unlinked successfully' 
    });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'UNLINK_PROVIDER_FAILED' });
  }
};
