const express = require('express');
const cors = require('cors');
const winston = require('winston');
const helmet = require('helmet');
const createBuildingsRouter = require('./routes/buildings');
const createProfessorsRouter = require('./routes/professors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const port = process.env.PORT || 3002;

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

const LOCAL_DEV_ORIGIN = 'http://localhost:3000';
const PRODUCTION_ORIGIN = 'https://dson-study-spaces.vercel.app';

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === LOCAL_DEV_ORIGIN) return true;
  if (origin === PRODUCTION_ORIGIN) return true;
  if (origin.endsWith('.vercel.app')) return true;
  const extra = process.env.ALLOWED_ORIGIN_EXTRA?.trim();
  if (extra && origin === extra) return true;
  return false;
}

// Middleware
app.use(express.json({ limit: '5mb' }));
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Add root route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Dickinson Study Spaces Backend' });
});

function getInternalApiSecret() {
  return (
    process.env.INTERNAL_API_SECRET?.trim() ||
    process.env.INTERNAL_API_KEY?.trim() ||
    ''
  );
}

// Auth middleware for /api/buildings
const buildingsAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const secret = getInternalApiSecret();
  if (!secret) {
    logger.warn('INTERNAL_API_SECRET is not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  const expectedAuth = `Bearer ${secret}`;
  if (!authHeader || authHeader !== expectedAuth) {
    logger.warn('Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const buildingsRouter = createBuildingsRouter(logger);
app.use('/api/buildings', buildingsAuthMiddleware, buildingsRouter);

const professorsRouter = createProfessorsRouter(logger);
app.use('/api/professors', professorsRouter);

app.use((err, req, res, _next) => {
  logger.error('Unhandled error: %s', err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Local dev only — Vercel imports the exported app as a serverless function
if (require.main === module) {
  app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
  });
}

module.exports = app;

