// secretGenerator.js: Generates cryptographically strong secrets

const crypto = require('crypto');

module.exports.generateSecret = async (length = 32) => {
    const secret = await crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    return secret;
};