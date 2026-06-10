/* eslint-disable security/detect-object-injection */
const VersionTracker = require('./versionTracker');
const { generateSecret, isStrongSecret } = require('./secretGenerator');

class SecretService {
    constructor() {
        this.tracker = new VersionTracker();
        this.initialized = false;
    }

    initialize(requiredSecrets = []) {
        if (this.initialized) return true;

        for (const secretName of requiredSecrets) {
            this.tracker.registerSecret(secretName, 1);
        }

        for (const secretName of requiredSecrets) {
            const versionedKey = this.tracker.getCurrentVersionedKey(secretName);
            const value = process.env[secretName] || process.env[versionedKey];
            
            if (!value) {
                throw new Error(`Missing required secret: ${secretName}`);
            }
            
            if (value.length < 32) {
                throw new Error(`${secretName} is too short. Minimum 32 characters required.`);
            }
            
            if (!isStrongSecret(value)) {
                console.warn(`Warning: ${secretName} may not be cryptographically strong`);
            }
        }

        this.initialized = true;
        return true;
    }

    getSecret(secretName) {
        if (!this.initialized) {
            console.warn('Warning: SecretService not initialized. Call initialize() at startup.');
        }

        const versionedKey = this.tracker.getCurrentVersionedKey(secretName);
        const value = process.env[secretName] || process.env[versionedKey];

        if (!value) {
            throw new Error(`Secret not found: ${secretName}`);
        }

        return value;
    }

    rotateSecret(secretName, length = 32) {
        const newSecret = generateSecret(length);
        const rotationInfo = this.tracker.rotateSecret(secretName, newSecret);
        return rotationInfo;
    }

    getRotationWarning(secretName, thresholdDays = 90) {
        const days = this.tracker.getDaysSinceRotation(secretName);
        if (days !== null && days >= thresholdDays) {
            return {
                secretName,
                warning: true,
                daysSinceRotation: days,
                message: `${secretName} rotation overdue. Last rotated ${days} days ago.`
            };
        }
        return null;
    }

    checkAllSecretsRotation(thresholdDays = 90) {
        return this.tracker.getSecretsNeedingRotation(thresholdDays);
    }
}

let instance = null;

function getSecretService() {
    if (!instance) {
        instance = new SecretService();
    }
    return instance;
}

module.exports = {
    SecretService,
    getSecretService
};