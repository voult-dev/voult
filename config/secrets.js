const crypto = require('crypto');

// Validate that all required secrets are present and strong
function validateSecrets() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    const requiredSecrets = {
        ENDUSER_JWT_SECRET: {
            required: true,
            minLength: 32,
            description: 'JWT secret for signing access tokens'
        },
        SESSION_SECRET: {
            required: isProduction,
            minLength: 32,
            description: 'Session secret for encrypting session data'
        },
        REFRESH_TOKEN_SECRET: {
            required: isProduction,
            minLength: 32,
            description: 'Secret for refresh token encryption'
        },
        CRYPTO_KEY: {
            required: isProduction,
            minLength: 32,
            description: 'Encryption key for sensitive data'
        }
    };
    
    const errors = [];
    const warnings = [];
    
    Object.entries(requiredSecrets).forEach(([key, config]) => {
        const value = process.env[key];
        
        // Check if required
        if (config.required && !value) {
            errors.push(`❌ Missing required secret: ${key} (${config.description})`);
        }
        
        // Check minimum length
        if (value && value.length < config.minLength) {
            errors.push(`❌ ${key} is too short. Minimum ${config.minLength} characters required, got ${value.length}`);
        }
        
        // Warn if not strong enough
        if (value && !isStrongSecret(value)) {
            warnings.push(`⚠️  ${key} appears weak. Consider using a cryptographically strong value`);
        }
    });
    
    if (errors.length > 0) {
        console.error('\n🔒 Secret Validation Failed:\n');
        errors.forEach(err => console.error(err));
        throw new Error('Critical secrets configuration error');
    }
    
    if (warnings.length > 0 && isProduction) {
        console.warn('\n⚠️  Secret Strength Warnings:\n');
        warnings.forEach(warn => console.warn(warn));
    }
    
    return true;
}

// Check if a secret is cryptographically strong
function isStrongSecret(secret) {
    if (secret.length < 32) return false;
    
    const entropy = calculateEntropy(secret);
    return entropy > 128;  // At least 128 bits of entropy
}

// Calculate Shannon entropy
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

// Generate a strong random secret for initialization
function generateStrongSecret(length = 32) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

module.exports = {
    validateSecrets,
    generateStrongSecret,
    isStrongSecret
};