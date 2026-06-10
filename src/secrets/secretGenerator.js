const crypto = require('crypto');

// This file handles internal security calculations - suppress false positive injection warnings
/* eslint-disable security/detect-object-injection */

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
        // char is from the string itself, not user input - safe pattern
        frequencies[char] = (frequencies[char] || 0) + 1;
    }
    let entropy = 0;
    for (const char in frequencies) {
        // char is a known key from our own object
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