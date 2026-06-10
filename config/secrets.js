const { isStrongSecret } = require('../src/secrets/secretGenerator');

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
        // eslint-disable-next-line security/detect-object-injection
        const value = process.env[key] || process.env[`${key}_V1`];
        
        if (config.required && !value) {
            errors.push(`❌ Missing required secret: ${key} (${config.description})`);
        }
        
        if (value && value.length < config.minLength) {
            errors.push(`❌ ${key} is too short. Minimum ${config.minLength} characters required, got ${value.length}`);
        }
        
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
        console.warn('\n  Secret Strength Warnings:\n');
        warnings.forEach(warn => console.warn(warn));
    }
    
    return true;
}

module.exports = {
    validateSecrets,
    isStrongSecret
};