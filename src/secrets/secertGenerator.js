// secretGenerator.js: Generates cryptographically strong secrets

const crypto = require('crypto');

class SecretGenerator {
    constructor() {
        this.secret = crypto.randomBytes(32).toString('hex');
    }

    generateSecret() {
        return this.secret;
    }
}

module.exports = SecretGenerator;