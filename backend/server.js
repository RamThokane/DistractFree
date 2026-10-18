require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const connectDB = require('./config/db');

// Middleware
const { globalErrorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const coinRoutes = require('./routes/coinRoutes');
const insightsRoutes = require('./routes/insightsRoutes');
const mlRoutes = require('./routes/mlRoutes');
const browsingRoutes = require('./routes/browsingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const scheduleRoutes = require('./routes/scheduleRoutes');

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Behind Vercel's proxy: use X-Forwarded-For for the client IP (rate limiting)
if (isProduction || process.env.VERCEL) app.set('trust proxy', 1);

// ── Security ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // React handles its own CSP
  crossOriginEmbedderPolicy: false,
}));

// ── NoSQL Injection Sanitization ───────────────────
app.use(mongoSanitize());

// ── CORS ───────────────────────────────────────────
// CLIENT_URL plus the comma-separated ALLOWED_ORIGINS, e.g.
//   CLIENT_URL=https://distractfree.site
//   ALLOWED_ORIGINS=https://distractfree.site,https://www.distractfree.site
const normaliseOrigin = (o) => o.trim().replace(/\/+$/, '');
const buildAllowedOrigins = () => {
  const origins = [process.env.CLIENT_URL, ...(process.env.ALLOWED_ORIGINS || '').split(',')]
    .filter(Boolean)
    .map(normaliseOrigin)
    .filter(Boolean);

  // Allow localhost ONLY in non-production environments
  if (!isProduction) {
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }

  return [...new Set(origins)];
};
const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin: function (origin, callback) {

      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      // Allow any chrome-extension:// origin (our extension)
      if (origin.startsWith('chrome-extension://')) return callback(null, true);

      // Allow configured origins
      if (allowedOrigins.includes(origin)) return callback(null, true);

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token'],
  })
);

// ── Body parsing ───────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(isProduction ? 'combined' : 'dev'));
}

// ── Rate limiting ──────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 300 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
app.use('/api/', apiLimiter);

// Stricter limiter for auth endpoints (prevents brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 20 : 100,
  message: { success: false, message: 'Too many auth attempts. Try again later.' },
  skipSuccessfulRequests: true, // Don't count successful logins
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Reset emails: count every request (the endpoint always answers 200)
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5 : 50,
  message: { success: false, message: 'Too many reset requests. Try again in 15 minutes.' },
});
app.use('/api/auth/forgot-password', resetLimiter);
app.use('/api/auth/reset-password', authLimiter);

// ── Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/browsing', browsingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/schedule', scheduleRoutes);

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
  });
});

// ── 404 handler ────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ───────────────────────────
app.use(globalErrorHandler);

// ── Start ──────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Connect to DB eagerly (cached for serverless cold starts)
let dbReady = connectDB();

// Only start listening when NOT running as a Vercel serverless function
if (!process.env.VERCEL) {
  dbReady.then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 DistractFree API running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health check: http://localhost:${PORT}/api/health\n`);
    });
  });
}

// ── Graceful shutdown ──────────────────────────────
const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] ${signal} received. Shutting down gracefully…`);
  const mongoose = require('mongoose');
  await mongoose.connection.close();
  console.log('[Server] MongoDB connection closed.');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = app; // Vercel uses this export
