const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
    secret: process.env.SECRET || process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false, 
    name: 'voultSessionId',  
    cookie: {
        secure: isProduction,  
        httpOnly: true,       
        sameSite: 'strict',     
        domain: isProduction ? '.voult.dev' : 'localhost',  // ✅ Restrict domain
        path: '/',
        maxAge: isProduction 
            ? 1000 * 60 * 60 * 1  // 1 hour in production
            : 1000 * 60 * 60 * 24 * 7  // 7 days in development
    }
};

// Validate required secrets
if (!process.env.SECRET && isProduction) {
    throw new Error('SESSION_SECRET or SECRET environment variable is required in production');
}

module.exports = sessionConfig;