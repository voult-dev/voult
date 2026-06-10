const VersionTracker = require('../../src/secrets/versionTracker');
const fs = require('fs');

describe('VersionTracker', () => {
    let tracker;

    beforeEach(() => {
        tracker = new VersionTracker();
    });

    test('should return version 1 for unregistered secrets', () => {
        expect(tracker.getVersion('UNKNOWN_SECRET_XYZ')).toBe(1);
    });

    test('should register secret with default values', () => {
        tracker.registerSecret('REG_SECRET_TEST');
        const secret = tracker.data.secrets['REG_SECRET_TEST'];
        expect(secret.version).toBe(1);
        expect(secret.createdAt).toBeDefined();
    });

    test('should return current versioned key', () => {
        tracker.registerSecret('VERSION_SECRET_TEST', 1);
        expect(tracker.getCurrentVersionedKey('VERSION_SECRET_TEST')).toBe('VERSION_SECRET_TEST_V1');
    });

    test('should increment version on rotation', () => {
        tracker.registerSecret('ROTATE_SECRET_TEST', 1);
        const result = tracker.rotateSecret('ROTATE_SECRET_TEST');
        expect(result.version).toBeGreaterThan(1);
        expect(result.versionedKey).toMatch(/ROTATE_SECRET_TEST_V\d+/);
    });

    test('should return days since rotation', () => {
        tracker.registerSecret('DAYS_SECRET_TEST', 1);
        tracker.data.secrets['DAYS_SECRET_TEST'].rotationDates = ['2024-01-01T00:00:00.000Z'];
        const days = tracker.getDaysSinceRotation('DAYS_SECRET_TEST');
        expect(days).toBeGreaterThan(0);
    });

    test('should return null for secrets without rotation dates', () => {
        tracker.registerSecret('NO_DATE_SECRET', 1);
        expect(tracker.getDaysSinceRotation('NO_DATE_SECRET')).toBe(null);
    });

    test('should identify secrets needing rotation', () => {
        const oldDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
        tracker.registerSecret('OLD_SECRET_TEST', 1);
        tracker.data.secrets['OLD_SECRET_TEST'].rotationDates = [oldDate];
        
        const needingRotation = tracker.getSecretsNeedingRotation(90);
        const found = needingRotation.find(s => s.name === 'OLD_SECRET_TEST');
        expect(found).toBeDefined();
    });

    test('should save tracker data to file', () => {
        tracker.registerSecret('SAVE_SECRET_TEST', 1);
        tracker.saveTracker();
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        expect(fs.existsSync(tracker.trackerPath)).toBe(true);
    });
});