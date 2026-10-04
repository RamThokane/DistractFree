const express = require('express');
const {
  createSchedule,
  listSchedule,
  getNextSchedule,
  updateSchedule,
  cancelSchedule,
  startNow,
} = require('../controllers/scheduleController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateCreateSchedule,
  validateUpdateSchedule,
  validateScheduleRange,
  validateScheduleId,
} = require('../middleware/validateRequest');

const router = express.Router();

// All schedule routes are protected
router.use(protect);

router.post('/', validateCreateSchedule, createSchedule);
router.get('/', validateScheduleRange, listSchedule);
router.get('/next', getNextSchedule);
router.put('/:id', validateScheduleId, validateUpdateSchedule, updateSchedule);
router.delete('/:id', validateScheduleId, cancelSchedule);
router.post('/:id/start-now', validateScheduleId, startNow);

module.exports = router;
