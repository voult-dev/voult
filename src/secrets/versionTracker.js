/* eslint-disable security/detect-object-injection */
/* eslint-disable security/detect-non-literal-fs-filename */
const fs = require('fs');
const path = require('path');

const SECRETS_TRACKER_PATH = path.join(__dirname, 'secrets.json');

class VersionTracker {
    constructor() {
        this.trackerPath = SECRETS_TRACKER_PATH;
        this.data = this.loadTracker();
    }

    loadTracker() {
        try {
            if (fs.existsSync(this.trackerPath)) {
                const raw = fs.readFileSync(this.trackerPath, 'utf8');
                return JSON.parse(raw);
            }
        } catch {
            // Silently fail - read-only filesystem or file doesn't exist in production
        }
        return { secrets: {} };
    }

    saveTracker() {
        fs.writeFileSync(this.trackerPath, JSON.stringify(this.data, null, 2), 'utf8');
    }

    registerSecret(secretName, version = 1) {
        if (!this.data.secrets[secretName]) {
            this.data.secrets[secretName] = {
                version: version,
                rotationDates: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.saveTracker();
        }
    }

    getVersion(secretName) {
        const secret = this.data.secrets[secretName];
        return secret ? secret.version : 1;
    }

    getCurrentVersionedKey(secretName) {
        const version = this.getVersion(secretName);
        return `${secretName}_V${version}`;
    }

    rotateSecret(secretName, newSecretValue = null) {
        const current = this.data.secrets[secretName] || {
            version: 1,
            rotationDates: [],
            createdAt: new Date().toISOString()
        };
        
        current.version += 1;
        current.rotationDates.push(new Date().toISOString());
        current.updatedAt = new Date().toISOString();
        
        this.data.secrets[secretName] = current;
        this.saveTracker();
        
        const newVersionedKey = this.getCurrentVersionedKey(secretName);
        return {
            versionedKey: newVersionedKey,
            version: current.version,
            newSecret: newSecretValue
        };
    }

    getLastRotationDate(secretName) {
        const secret = this.data.secrets[secretName];
        if (secret && secret.rotationDates.length > 0) {
            return new Date(secret.rotationDates[secret.rotationDates.length - 1]);
        }
        return null;
    }

    getDaysSinceRotation(secretName) {
        const lastRotation = this.getLastRotationDate(secretName);
        if (!lastRotation) return null;
        const now = new Date();
        const diffMs = now.getTime() - lastRotation.getTime();
        return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }

    getSecretsNeedingRotation(thresholdDays = 90) {
        const needingRotation = [];
        for (const secretName of Object.keys(this.data.secrets)) {
            const days = this.getDaysSinceRotation(secretName);
            if (days !== null && days >= thresholdDays) {
                needingRotation.push({
                    name: secretName,
                    daysSinceRotation: days,
                    version: this.getVersion(secretName)
                });
            }
        }
        return needingRotation;
    }

    getAllSecrets() {
        return this.data.secrets;
    }
}

module.exports = VersionTracker;