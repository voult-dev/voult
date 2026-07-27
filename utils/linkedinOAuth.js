const axios = require('axios');
const { ApiError } = require('./apiError');

module.exports.exchangeCodeForToken = async ({
  code,
  clientId,
  clientSecret,
  redirectUri
}) => {
  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const { data } = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return data.access_token;
  } catch (error) {
    const details = error.response?.data;
    console.error('LinkedIn token exchange error:', details || error.message);
    throw new ApiError(
      401,
      'LINKEDIN_TOKEN_EXCHANGE_FAILED',
      details?.error_description || details?.error || 'Failed to exchange LinkedIn authorization code'
    );
  }
};

module.exports.getLinkedInProfile = async (accessToken) => {
  try {
    const { data } = await axios.get(
      'https://api.linkedin.com/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    return {
      linkedinId: data.sub,
      email: data.email,
      fullName:
        data.given_name && data.family_name
          ? `${data.given_name} ${data.family_name}`
          : data.name || null
    };
  } catch (error) {
    console.error('LinkedIn profile fetch error:', error.response?.data || error.message);
    throw new ApiError(
      401,
      'LINKEDIN_PROFILE_FETCH_FAILED',
      'Failed to fetch LinkedIn profile'
    );
  }
};