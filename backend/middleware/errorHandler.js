/**
 * Centralised async error handling wrapper.
 *
 * Wraps async route handlers so that rejected promises are automatically
 * forwarded to Express's error handler instead of causing unhandled
 * promise rejections.
 *
 * Usage:
 *   const { asyncHandler } = require('../middleware/errorHandler');
 *   router.get('/endpoint', asyncHandler(async (req, res) => { ... }));
 */

/**
 * Wrap an async Express handler to catch thrown errors.
 * @param {Function} fn — async (req, res, next) => { ... }
 * @returns {Function}
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Custom application error class with HTTP status code.
 */
class AppError extends Error {
  /**
   * @param {string} message — human-readable error message
   * @param {number} statusCode — HTTP status code (default 500)
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Express error-handling middleware.
 *
 * Handles:
 *   - AppError (operational, expected errors)
 *   - Mongoose ValidationError
 *   - Mongoose CastError (invalid ObjectId)
 *   - Mongoose 11000 (duplicate key)
 *   - JWT errors
 *   - All other unexpected errors
 */
const globalErrorHandler = (err, _req, res, _next) => {
  // Default values
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let errors = null;

  // ── Mongoose validation error ───────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join(', ');
    errors = Object.entries(err.errors).map(([field, e]) => ({
      field,
      message: e.message,
    }));
  }

  // ── Mongoose cast error (bad ObjectId) ──────────
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ── Mongoose duplicate key ──────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field
      ? `Duplicate value for "${field}"`
      : 'Duplicate entry';
  }

  // ── JWT errors ──────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired — please login again';
  }

  // ── Log in development ─────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    console.error('[Error]', statusCode, message);
    if (!err.isOperational) {
      console.error(err.stack);
    }
  }

  // ── Response ───────────────────────────────────
  const responseBody = {
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : message,
  };

  if (errors) {
    responseBody.errors = errors;
  }

  // Include stack trace in development for non-operational errors
  if (process.env.NODE_ENV !== 'production' && !err.isOperational) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

module.exports = { asyncHandler, AppError, globalErrorHandler };
