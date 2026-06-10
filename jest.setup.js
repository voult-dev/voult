// jest.setup.js
// Mock node-fetch using manual mock
jest.mock('node-fetch');

// Mock isomorphic-dompurify to handle ESM compatibility
jest.mock('isomorphic-dompurify', () => ({
	default: {
		sanitize: (input, options) => {
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


