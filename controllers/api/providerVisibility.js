const App = require('../../models/app');
const { SafeQueryBuilder } = require('../../middleware/queryValidation');
const {ApiError} = require('../../utils/apiError')

const appBuilder = new SafeQueryBuilder(App);

module.exports.getProviderVisibility = async (req, res) => {
  try {
    const { clientId } = req.params;
    
    const app = await appBuilder.findOne({clientId});
    
    if (!app || !app.isActive) {
      throw new ApiError(
        404,
        'APP_NOT_FOUND',
        'Could not found app in the database'
      );
    };
    
    // Return visibility status for all providers
    const visibility = {
      google: app.googleOAuth?.enabled,
      github: app.githubOAuth?.enabled,
      facebook: app.facebookOAuth?.enabled,
      linkedin: app.linkedinOAuth?.enabled,
      apple: app.appleOAuth?.enabled,
      microsoft: app.microsoftOAuth?.enabled
    };

    return res.json({ providers: visibility });
    
  } catch {
    throw new ApiError(
      500,
      'FETCH_PROVIDER_VISIBILITY_FAILED',
      'Provider Visibility Failed'
    )
  }
};