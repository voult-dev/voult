const crypto = require('crypto');

function generateSecret(length = 32) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

function isStrongSecret(secret) {
    if (secret.length < 32) return false;
    return true;
}

function calculateEntropy(str) {
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in frequencies) {
        const p = frequencies[char] / len;
        entropy -= p * Math.log2(p);
    }
    return entropy * len;
}

module.exports = {
    generateSecret,
    isStrongSecret,
    calculateEntropy
};