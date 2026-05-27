const isProduction = process.env.NODE_ENV === 'production';

const sessionConfig = {
  secret: process.env.SECRET || process.env.SESSION_SECRET,

  resave: false,
  saveUninitialized: false,

  name: 'voultSessionId',

   cookie: {
     // Secure in production, otherwise based on environment
     secure: isProduction ? 'auto' : false,
     httpOnly: true,
     sameSite: 'lax',
     path: '/',
     // Domain restriction: in production, set to your domain; in development, leave undefined
     domain: isProduction ? process.env.SESSION_COOKIE_DOMAIN : undefined,
     maxAge: isProduction
       ? 1000 * 60 * 60 * 24 // 24 hours in production (reduced from 24 hours)
       : 1000 * 60 * 60 * 24 * 7, // 1 week in development
   },
};

// if ((!process.env.SECRET && !process.env.SESSION_SECRET) && isProduction) {
//   throw new Error(
//     'SECRET or SESSION_SECRET environment variable is required in production'
//   );
// }

module.exports = sessionConfig;
