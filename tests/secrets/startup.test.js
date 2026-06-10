const { SecretService } = require('../../src/secrets/secretService');

describe('Startup Validation', () => {
    beforeEach(() => {
        const SecretServiceModule = require('../../src/secrets/secretService');
        SecretServiceModule.instance = null;
    });

    test('should fail with short secrets', () => {
        const service = new SecretService();
        process.env.SHORT_STARTUP_SECRET = 'tooshort';
        
        expect(() => service.initialize(['SHORT_STARTUP_SECRET'])).toThrow('too short');
        
        delete process.env.SHORT_STARTUP_SECRET;
    });

    test('should initialize with valid secrets', () => {
        const service = new SecretService();
        process.env.VALID_STARTUP_SECRET = 'a'.repeat(32);
        
        expect(() => service.initialize(['VALID_STARTUP_SECRET'])).not.toThrow();
        
        delete process.env.VALID_STARTUP_SECRET;
    });

    test('should throw on missing secrets', () => {
        const service = new SecretService();
        expect(() => service.initialize(['NONEXISTENT_STARTUP_SECRET'])).toThrow('Missing required secret');
    });
});