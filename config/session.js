const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
  secret: process.env.SECRET,

  resave: false,
  saveUninitialized: false,

  name: 'voultSessionId',

  cookie: {
    // 'auto' → secure cookie on HTTPS, plain cookie on http://localhost
    secure: isProduction ? 'auto' : false,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: isProduction
      ? 1000 * 60 * 60 * 24
      : 1000 * 60 * 60 * 24 * 7,
  },
};

if (!process.env.SECRET && isProduction) {
  throw new Error(
    'SECRET environment variable is required in production'
  );
}

module.exports = sessionConfig;
