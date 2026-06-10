const csrf = require('csurf');

// CSRF protection middleware
const csrfProtection = csrf({ 
    cookie: false,  // Use session instead of cookies
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS']  // Only protect state-changing methods
});

// Middleware to generate and attach CSRF token to response locals
const generateCsrfToken = (req, res, next) => {
    res.locals.csrfToken = req.csrfToken();
    next();
};

module.exports = {
    csrfProtection,
    generateCsrfToken
};