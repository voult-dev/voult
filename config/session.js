const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'voultSessionId',

    cookie: {
        secure: isProduction,
        httpOnly: true,

        sameSite: isProduction ? 'lax' : 'lax',

        // IMPORTANT: hostname only
        // domain: isProduction ? '.voult.dev' : undefined,

        path: '/',

        maxAge: isProduction
            ? 1000 * 60 * 60 * 1
            : 1000 * 60 * 60 * 24 * 7
    }
};

if (!process.env.SESSION_SECRET && !process.env.SECRET && isProduction) {
    throw new Error(
        'SESSION_SECRET or SECRET environment variable is required in production'
    );
}

module.exports = sessionConfig;