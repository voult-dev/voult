const crypto = require('crypto');

class SecretRotationService {
    constructor(secretName, rotationIntervalDays = 90) {
        this.secretName = secretName;
        this.rotationIntervalDays = rotationIntervalDays;
        this.lastRotation = process.env[`${secretName}_ROTATION_DATE`] 
            ? new Date(process.env[`${secretName}_ROTATION_DATE`])
            : new Date();
    }
    
    shouldRotate() {
        const rotationDate = new Date(this.lastRotation);
        rotationDate.setDate(rotationDate.getDate() + this.rotationIntervalDays);
        return new Date() > rotationDate;
    }
    
    generateNewSecret(length = 32) {
        return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    }
    
    getRotationDate() {
        return this.lastRotation;
    }
    
    logRotation(oldSecret, newSecret) {
        console.log(`\n🔄 Secret Rotation Required: ${this.secretName}`);
        console.log(`Last rotated: ${this.lastRotation.toISOString()}`);
        console.log(`Next rotation due: ${new Date(this.lastRotation.getTime() + this.rotationIntervalDays * 24 * 60 * 60 * 1000).toISOString()}`);
        console.log('\nNew secret generated. Update your .env file:');
        console.log(`${this.secretName}=${newSecret}`);
    }
}

module.exports = SecretRotationService;