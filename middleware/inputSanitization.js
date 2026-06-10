const { body, validationResult } = require('express-validator');
const DOMPurify = require('isomorphic-dompurify');

// Sanitize function that removes dangerous content
const sanitize = (input) => {
    if (typeof input !== 'string') return input;
    
    // Remove HTML tags and dangerous attributes
    return DOMPurify.sanitize(input, { 
        ALLOWED_TAGS: [],  // No HTML tags allowed
        ALLOWED_ATTR: []
    }).trim();
};

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'VALIDATION_ERROR',
            messages: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Pre-defined validators for common fields
const validators = {
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),
    
    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters'),
    
    username: body('username')
        .matches(/^[a-zA-Z0-9_]{3,30}$/)
        .withMessage('Username must be 3-30 characters, alphanumeric and underscores only'),
    
    fullName: body('fullName')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .escape()  // Escape HTML special characters
        .withMessage('Full name must not exceed 100 characters'),
    
    url: body('redirectUrl')
        .isURL()
        .withMessage('Invalid URL format')
};

module.exports = {
    sanitize,
    handleValidationErrors,
    validators
};