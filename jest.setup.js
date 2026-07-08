// jest.setup.js
// Mock node-fetch using manual mock
jest.mock('node-fetch');

if (!process.env.ENDUSER_JWT_SECRET || process.env.ENDUSER_JWT_SECRET.length < 32) {
  process.env.ENDUSER_JWT_SECRET = 'test-enduser-jwt-secret-32chars!!';
}

// Mock isomorphic-dompurify to handle ESM compatibility
jest.mock('isomorphic-dompurify', () => ({
	default: {
		sanitize: (input) => {
			if (typeof input !== 'string') return input;
			// Simple sanitization: remove HTML tags
			return input
				// eslint-disable-next-line security/detect-unsafe-regex
				.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
				.replace(/<[^>]+>/g, '')
				.trim();
		}
	},
	__esModule: true
}), { virtual: true });

// Suppress dotenv logging during tests


