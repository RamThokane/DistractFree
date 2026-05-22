require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');

// Middleware
const { globalErrorHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const websiteRoutes = require('./routes/websiteRoutes');
const coinRoutes = require('./routes/coinRoutes');
const insightsRoutes = require('./routes/insightsRoutes');
const browsingRoutes = require('./routes/browsingRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// ── Security ───────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL || 'http://localhost:3000',
        'http://localhost:3000',
      ];

      // Allow requests with no origin (mobile apps, curl, extensions)
      if (!origin) return callback(null, true);

      // Allow any chrome-extension:// origin
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
  app.use(morgan('dev'));
}

// ── Rate limiting ──────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased to avoid blocking during testing
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
app.use('/api/', apiLimiter);

// Stricter limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // Increased to avoid blocking during testing
  message: { success: false, message: 'Too many auth attempts. Try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ─────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/websites', websiteRoutes);
app.use('/api/coins', coinRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/browsing', browsingRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
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

