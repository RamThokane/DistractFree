/**
 * Request validation middleware.
 *
 * Centralised input sanitisation helpers that can be applied to any route.
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Check validation results and return 400 with errors if any failed.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

// ── Auth validators ────────────────────────────────

const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 60 }).withMessage('Name cannot exceed 60 characters'),
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain a letter'),
  handleValidationErrors,
];

const validateLogin = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

// ── Session validators ─────────────────────────────

const validateStartSession = [
  body('plannedDuration')
    .isInt({ min: 1, max: 480 }).withMessage('plannedDuration must be between 1 and 480 minutes'),
  handleValidationErrors,
];

const validateEndSession = [
  body('sessionId')
    .isMongoId().withMessage('Valid sessionId is required'),
  body('cancelled')
    .optional()
    .isBoolean().withMessage('cancelled must be boolean'),
  handleValidationErrors,
];

// ── Website validators ─────────────────────────────

const validateAddWebsite = [
  body('websiteUrl')
    .trim()
    .notEmpty().withMessage('websiteUrl is required')
    .isLength({ max: 500 }).withMessage('URL too long'),
  body('category')
    .optional()
    .isIn([
      'social_media', 'entertainment', 'news', 'shopping',
      'gaming', 'streaming', 'messaging', 'other',
    ]).withMessage('Invalid category'),
  handleValidationErrors,
];

const validateRemoveWebsite = [
  body('websiteId')
    .isMongoId().withMessage('Valid websiteId is required'),
  handleValidationErrors,
];

const validateUnlockWebsite = [
  body('websiteId')
    .isMongoId().withMessage('Valid websiteId is required'),
  handleValidationErrors,
];

// ── Browsing log validators ────────────────────────

const validateBrowsingLog = [
  body('website')
    .trim()
    .notEmpty().withMessage('website is required')
    .isLength({ max: 500 }).withMessage('Website URL too long'),
  body('duration')
    .optional()
    .isInt({ min: 0 }).withMessage('Duration must be a non-negative integer'),
  body('wasBlocked')
    .optional()
    .isBoolean().withMessage('wasBlocked must be boolean'),
  handleValidationErrors,
];

// ── Pagination validators ──────────────────────────

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  handleValidationErrors,
];

// ── Param validators ───────────────────────────────

const validateMongoIdParam = [
  param('id')
    .isMongoId().withMessage('Invalid ID format'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateStartSession,
  validateEndSession,
  validateAddWebsite,
  validateRemoveWebsite,
  validateUnlockWebsite,
  validateBrowsingLog,
  validatePagination,
  validateMongoIdParam,
};
