require('dotenv').config();

// Validate secrets before initializing app
const { validateSecrets } = require('../config/secrets');

try {
    validateSecrets();
} catch (err) {
    console.error('Fatal Error:', err.message);
    process.exit(1);
};

const SecretRotationService = require('../services/secretRotation');

const secretsToTrack = [
  'ENDUSER_JWT_SECRET',
  'SESSION_SECRET', 
  'REFRESH_TOKEN_SECRET'
];

secretsToTrack.forEach(secretName => {
  const rotator = new SecretRotationService(secretName, 90);
  if (rotator.shouldRotate()) {
    const newSecret = rotator.generateNewSecret();
    rotator.logRotation(null, newSecret);
    // In production, alert your team via email/Slack here
  }
});

const secretsToCheck = ['ENDUSER_JWT_SECRET', 'SESSION_SECRET', 'REFRESH_TOKEN_SECRET'];
secretsToCheck.forEach(name => {
  const svc = new SecretRotationService(name, 90);
  if (svc.shouldRotate()) {
    console.warn(`⚠️  Secret rotation due: ${name} (last rotated ${svc.getRotationDate().toDateString()})`);
  }
});  

['ENDUSER_JWT_SECRET', 'BASE_URL'].forEach((key) => {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    throw new Error(`${key} is missing or empty. Set it in .env with no spaces around = (e.g. BASE_URL=https://www.voult.dev).`);
  }
});

if (process.env.NODE_ENV === 'production' && (!process.env.SECRET || !String(process.env.SECRET).trim())) {
  throw new Error('SECRET is required in production for session cookies. Set it in .env.');
}


const express = require('express');
const app = express();

app.set('trust proxy', 1);

const ejsMate = require('ejs-mate');
const path = require('path');

const session = require('express-session');
const flash = require('connect-flash');

const passport = require('../config/passport');
const { listGoogleRedirectUris } = require('../utils/resolveOAuthCallbackUrl');

const { csrfProtection, generateCsrfToken } = require('../middleware/csrfProtection');
const securityHeaders = require('../middleware/securityHeaders');

const sessionConfig = require('../config/session');

if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
  console.warn(
    'WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google sign-in will fail.'
  );
}

const methodOverride = require('method-override');

const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://www.voult.dev',
      'https://voult.dev',
      'https://voult.onrender.com',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'x-client-secret',
    'X-Client-Id',
    'x-client-token',
    'Authorization'
  ]
};

app.use(cors(corsOptions));

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerSpec = YAML.load('./docs/openapi.yaml');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'voult.dev API Docs',
  customCss: `
    .swagger-ui .topbar {
      background-color: #0f172a;
    }
  `,
}));

const ExpressError = require('../utils/ExpressError');

const routes = require('../routes/index');

require('../config/database')();

app.use(session(sessionConfig));
app.use(flash());

app.use(express.json());
app.use(express.urlencoded({ 
  extended: true,
  limit: '10kb'
}));

app.use(csrfProtection);

// app.use(securityHeaders);

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    try {
      res.locals.csrfToken = req.csrfToken();
    } catch (err) {
      // Session may not be initialized yet on first request
      res.locals.csrfToken = '';
      console.warn('csrfToken generation failed:', err.message);
    }
  } else {
    res.locals.csrfToken = '';
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

app.engine('ejs', ejsMate);

app.use(express.static(path.join(__dirname, '../public')));

app.use(methodOverride('_method'));

// Set res.locals BEFORE mounting routes so EJS templates always have these vars
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.currentUser = req.user;
    next();
});

const {requestLogger} = require('../middleware/requestLogger');
app.use(requestLogger);

app.use(routes); 

// Error Handler
const { sendError } = require('../utils/apiError');

app.use('/api', (err, req, res, next) => {
  console.error('API ERROR:', err);
  return sendError(res, err);
});

app.use((req, res, next) => {
  next(new ExpressError('Page Not Found', 404));
});

app.use((err, req, res, next) => {
  const status = err.statusCode || err.status || 500;

  // Handle CSRF errors specifically
  if (err.code === 'EBADCSRFTOKEN') {
    if (req.originalUrl.startsWith('/api')) {
      return res.status(403).json({
        error: {
          code: 'INVALID_CSRF_TOKEN',
          message: 'CSRF token validation failed',
          status: 403
        }
      });
    }
    // For web routes, flash and redirect
    req.flash('error', 'Form session expired. Please try again.');
    return res.redirect('/');
  }

  // API error handler
  if (req.originalUrl.startsWith('/api')) {
    console.error(err);
    return res.status(status).json({
      error: err.message || 'Something went wrong'
    });
  }

  // Web error handler - ensure locals exist for EJS
  res.locals.success = res.locals.success || [];
  res.locals.error = res.locals.error || [];
  res.locals.info = res.locals.info || [];
  res.locals.currentUser = res.locals.currentUser || null;

  if (status === 404) {
    return res.status(404).render('error/404', { title: 'Page Not Found' });
  }
  
  res.status(status).render('error/500', { title: 'Internal Server Error' });
});
  
const PORT = process.env.PORT || 3000;

// Only start server if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`App is listening on PORT ${PORT}`);
  });
}

module.exports = app;