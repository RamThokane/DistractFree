const mongoose = require('mongoose');

/**
 * Connect to MongoDB with retry logic and connection pooling.
 *
 * In production: MONGO_URI is required — fails hard if missing.
 * In development: Falls back to in-memory MongoDB if external DB unavailable.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  const isProduction = process.env.NODE_ENV === 'production';

  // ── Production: MONGO_URI is mandatory ───────────
  if (isProduction && !mongoUri) {
    console.error('[DB] FATAL: MONGO_URI environment variable is required in production.');
    process.exit(1);
  }

  // ── Try external MongoDB first ───────────────────
  if (mongoUri) {
    const RETRY_LIMIT = isProduction ? 5 : 1;
    const RETRY_DELAY_MS = 3000;

    for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
      try {
        const conn = await mongoose.connect(mongoUri, {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
        });

        console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
        _attachListeners();
        return conn;
      } catch (error) {
        console.error(`[DB] Connection attempt ${attempt}/${RETRY_LIMIT} failed: ${error.message}`);

        if (attempt === RETRY_LIMIT) {
          if (isProduction) {
            console.error('[DB] All connection attempts exhausted. Exiting.');
            process.exit(1);
          }
          console.warn('[DB] Falling back to in-memory MongoDB…');
          break;
        }

        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  // ── Fallback: in-memory MongoDB (development only) ──
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');

    console.log('[DB] Starting in-memory MongoDB server…');
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const conn = await mongoose.connect(uri, { maxPoolSize: 10 });

    console.log(`[DB] In-memory MongoDB connected: ${uri}`);
    console.log('[DB] Warning: Data will NOT persist after server restart.');

    _attachListeners();

    process.on('beforeExit', async () => {
      await mongod.stop();
    });

    return conn;
  } catch (error) {
    console.error('[DB] Failed to start in-memory MongoDB:', error.message);
    console.error('[DB] Set MONGO_URI in .env or install: npm install mongodb-memory-server');
    process.exit(1);
  }
};

function _attachListeners() {
  mongoose.connection.on('error', (err) => {
    console.error('[DB] Runtime connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected.');
  });
}

module.exports = connectDB;
