/**
 * CSRF Token Utility
 * 
 * Provides helpers for managing CSRF tokens and making authenticated API calls
 * 
 * Usage:
 *   const token = await getCsrfToken();
 *   const response = await apiCall('/api/some-endpoint', {
 *     method: 'POST',
 *     body: JSON.stringify({ data: 'value' })
 *   });
 */

let cachedToken = null;

/**
 * Fetches and caches the CSRF token from the server
 * @returns {Promise<string>} CSRF token
 */
async function getCsrfToken() {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    const response = await fetch('/csrf-token', {
      method: 'GET',
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.statusText}`);
    }

    const { token } = await response.json();
    cachedToken = token;
    return token;
  } catch (error) {
    console.error('CSRF token fetch error:', error);
    throw error;
  }
}

/**
 * Makes an authenticated API call with automatic CSRF token injection
 * 
 * @param {string} url - API endpoint URL
 * @param {object} options - Fetch options
 * @param {string} options.method - HTTP method (default: GET)
 * @param {object} options.headers - Custom headers (merged with CSRF header)
 * @param {*} options.body - Request body
 * @param {boolean} options.credentials - Include credentials (default: 'include')
 * @returns {Promise<Response>} Fetch response
 */
async function apiCall(url, options = {}) {
  const token = await getCsrfToken();

  const headers = {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
    ...options.headers
  };

  return fetch(url, {
    ...options,
    credentials: options.credentials !== undefined ? options.credentials : 'include',
    headers
  });
}

/**
 * Clears the cached CSRF token
 * Useful when logging out or when the session changes
 */
function clearCsrfToken() {
  cachedToken = null;
}
