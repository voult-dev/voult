const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'https://www.voult.dev',
      'https://voult.onrender.com/'    
    ];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },

  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: [
    'Content-Type',
    'x-client-secret',
    'X-Client-Id'
  ],

  credentials: true
};

module.exports = corsOptions;
