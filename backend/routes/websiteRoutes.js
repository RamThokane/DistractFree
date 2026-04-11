const express = require('express');
const {
  addWebsite,
  removeWebsite,
  listWebsites,
  toggleWebsite,
  unlockWebsite,
} = require('../controllers/websiteController');
const { protect } = require('../middleware/authMiddleware');
const {
  validateAddWebsite,
  validateRemoveWebsite,
  validateUnlockWebsite,
  validateMongoIdParam,
} = require('../middleware/validateRequest');

const router = express.Router();

router.use(protect);

router.post('/add', validateAddWebsite, addWebsite);
router.delete('/remove', validateRemoveWebsite, removeWebsite);
router.get('/list', listWebsites);
router.patch('/toggle/:id', validateMongoIdParam, toggleWebsite);
router.post('/unlock', validateUnlockWebsite, unlockWebsite);

module.exports = router;
