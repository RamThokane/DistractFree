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

const validateForgotPassword = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  handleValidationErrors,
];

const validateResetPassword = [
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  body('token')
    .isString().isLength({ min: 64, max: 64 }).withMessage('This reset link is invalid'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[a-zA-Z]/).withMessage('Password must contain a letter'),
  handleValidationErrors,
];

// ── Session validators ─────────────────────────────

const validateStartSession = [
  body('plannedDuration')
    .isInt({ min: 1, max: 480 }).withMessage('plannedDuration must be between 1 and 480 minutes'),
  // IANA timezone, e.g. "Asia/Kolkata". Unknown zones are ignored server-side.
  body('timezone')
    .optional()
    .isString().isLength({ max: 64 }).withMessage('timezone must be an IANA timezone name'),
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

// ── Scheduled session validators ───────────────────
// Shape only; future start time and overlaps are checked in scheduleService.

const scheduleFields = (required) => {
  const req = (chain) => (required ? chain : chain.optional());
  return [
    req(body('title'))
      .isString().withMessage('title is required')
      .trim()
      .notEmpty().withMessage('title is required')
      .isLength({ max: 100 }).withMessage('title cannot exceed 100 characters'),
    body('subject')
      .optional({ values: 'null' })
      .isString().trim()
      .isLength({ max: 60 }).withMessage('subject cannot exceed 60 characters'),
    req(body('startAt'))
      .isISO8601().withMessage('startAt must be an ISO 8601 date'),
    req(body('plannedDuration'))
      .isInt({ min: 5, max: 240 }).withMessage('Duration must be between 5 and 240 minutes')
      .toInt(),
    body('repeat')
      .optional()
      .isIn(['none', 'daily', 'weekly']).withMessage("repeat must be 'none', 'daily' or 'weekly'"),
    body('repeatDays')
      .optional()
      .isArray({ max: 7 }).withMessage('repeatDays must be a list of weekdays'),
    body('repeatDays.*')
      .isInt({ min: 0, max: 6 }).withMessage('repeatDays must be weekdays 0 (Sun) to 6 (Sat)')
      .toInt(),
    body('timezone')
      .optional()
      .isString().isLength({ max: 64 }).withMessage('timezone must be an IANA timezone name'),
  ];
};

const validateCreateSchedule = [...scheduleFields(true), handleValidationErrors];
const validateUpdateSchedule = [...scheduleFields(false), handleValidationErrors];

const validateScheduleRange = [
  query('from').isISO8601().withMessage('from must be an ISO 8601 date'),
  query('to').isISO8601().withMessage('to must be an ISO 8601 date'),
  handleValidationErrors,
];

// Occurrence ids: "<24-hex id>" or "<24-hex series id>_<start ms>"
const validateScheduleId = [
  param('id').matches(/^[a-f0-9]{24}(_\d{1,15})?$/i).withMessage('Invalid scheduled session id'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateStartSession,
  validateEndSession,
  validateAddWebsite,
  validateRemoveWebsite,
  validateUnlockWebsite,
  validateBrowsingLog,
  validatePagination,
  validateMongoIdParam,
  validateCreateSchedule,
  validateUpdateSchedule,
  validateScheduleRange,
  validateScheduleId,
};
