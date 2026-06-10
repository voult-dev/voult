const { SecretService, getSecretService } = require('../../src/secrets/secretService');
const fs = require('fs');
const path = require('path');

describe('SecretService', () => {
    const SECRETS_PATH = path.join(__dirname, '../../src/secrets/secrets.json');
    const BACKUP_PATH = SECRETS_PATH + '.orig';

    beforeAll(() => {
        if (fs.existsSync(SECRETS_PATH)) {
            fs.copyFileSync(SECRETS_PATH, BACKUP_PATH);
        }
    });

    afterAll(() => {
        if (fs.existsSync(BACKUP_PATH)) {
            fs.copyFileSync(BACKUP_PATH, SECRETS_PATH);
            fs.unlinkSync(BACKUP_PATH);
        }
    });

    beforeEach(() => {
        // Clear the secrets.json for clean test state
        fs.writeFileSync(SECRETS_PATH, JSON.stringify({ secrets: {} }, null, 2));
        const SecretServiceModule = require('../../src/secrets/secretService');
        SecretServiceModule.instance = null;
    });

    test('should initialize successfully with valid secrets', () => {
        process.env.VALID_SECRET = 'a'.repeat(32);
        const service = new (require('../../src/secrets/secretService').SecretService)();
        const result = service.initialize(['VALID_SECRET']);
        expect(result).toBe(true);
        expect(service.initialized).toBe(true);
        delete process.env.VALID_SECRET;
    });

    test('should throw error for missing required secret', () => {
        const service = new (require('../../src/secrets/secretService').SecretService)();
        expect(() => service.initialize(['NONEXISTENT_SECRET_12345'])).toThrow('Missing required secret');
    });

    test('should throw error for short secrets', () => {
        process.env.SHORT_SECRET = 'tooshort';
        const service = new (require('../../src/secrets/secretService').SecretService)();
        expect(() => service.initialize(['SHORT_SECRET'])).toThrow('too short');
        delete process.env.SHORT_SECRET;
    });

    test('should retrieve secrets by name', () => {
        process.env.TEST_RETRIEVE_SECRET = 'testvalue12345678901234567890abcd';
        const service = new (require('../../src/secrets/secretService').SecretService)();
        service.initialize(['TEST_RETRIEVE_SECRET']);
        const secret = service.getSecret('TEST_RETRIEVE_SECRET');
        expect(secret).toBe('testvalue12345678901234567890abcd');
        delete process.env.TEST_RETRIEVE_SECRET;
    });

    test('should throw on missing secret during retrieval', () => {
        const service = new (require('../../src/secrets/secretService').SecretService)();
        service.initialize([]);
        expect(() => service.getSecret('MISSING_SECRET')).toThrow('Secret not found');
    });

    test('should generate and rotate secrets', () => {
        const service = new (require('../../src/secrets/secretService').SecretService)();
        const result = service.rotateSecret('ROTATE_TEST');
        expect(result.newSecret.length).toBe(32);
        expect(service.tracker.getVersion('ROTATE_TEST')).toBeGreaterThan(1);
    });

    test('should return rotation warning for overdue secrets', () => {
        const service = new (require('../../src/secrets/secretService').SecretService)();
        service.tracker.data.secrets['OVERDUE_SECRET'] = {
            version: 1,
            rotationDates: ['2024-01-01T00:00:00.000Z'],
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01'
        };
        
        const warning = service.getRotationWarning('OVERDUE_SECRET', 90);
        expect(warning).not.toBe(null);
    });

    test('should return null for secrets without rotation date', () => {
        process.env.FRESH_SECRET = 'freshsecretvalue12345678901234abcd';
        const service = new (require('../../src/secrets/secretService').SecretService)();
        service.initialize(['FRESH_SECRET']);
        
        const warning = service.getRotationWarning('FRESH_SECRET', 90);
        expect(warning).toBe(null);
        delete process.env.FRESH_SECRET;
    });

    test('getSecretService returns singleton instance', () => {
        const svc1 = getSecretService();
        const svc2 = getSecretService();
        expect(svc1).toBe(svc2);
    });
});