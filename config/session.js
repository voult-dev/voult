const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
  secret: process.env.SECRET,

  resave: false,
  saveUninitialized: false,

  name: 'voultSessionId',

  cookie: {
    // Secure in production, otherwise based on environment
    secure: isProduction ? true : false,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    // Domain restriction: in production, set to your domain; in development, leave undefined
    domain: isProduction ? process.env.SESSION_COOKIE_DOMAIN : undefined,
    maxAge: isProduction
      ? 1000 * 60 * 60 * 2 // 2 hours in production (reduced from 24 hours)
      : 1000 * 60 * 60 * 24 * 7, // 1 week in development
  },
};

if (!process.env.SECRET && isProduction) {
  throw new Error(
    'SECRET environment variable is required in production'
  );
}

module.exports = sessionConfig;
