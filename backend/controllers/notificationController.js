const Notification = require('../models/Notification');
const User = require('../models/User');
const { runScheduledChecks } = require('../services/notificationScheduler');

// ────────────────────────────────────────────────────
// GET /api/notifications
// ────────────────────────────────────────────────────
exports.getNotifications = async (req, res) => {
  try {
    // Time-based reminders (focus reminder, streak alert, weekly report) are
    // generated lazily here, so they work without a cron job on serverless.
    await runScheduledChecks(req.user._id, req.query.tz);

    const { limit = 20, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, unreadCount, total] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ read: 1, createdAt: -1 }) // unread first, then newest
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments({ userId: req.user._id, read: false }),
      Notification.countDocuments({ userId: req.user._id }),
    ]);

    res.json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[Notifications] Get error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/notifications/unread-count
// ────────────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });
    res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error('[Notifications] Unread count error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// PATCH /api/notifications/:id/read
// ────────────────────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error('[Notifications] Mark read error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// PATCH /api/notifications/read-all
// ────────────────────────────────────────────────────
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('[Notifications] Mark all read error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// Helper: Create a notification (used by other controllers)
// ────────────────────────────────────────────────────
// Notification type → the user's preference toggle that controls it (Settings page)
const PREFERENCE_FOR_TYPE = {
  coins_earned: 'coinEarned',
  coins_spent: 'coinEarned',
  streak_milestone: 'streakAlert',
  streak_alert: 'streakAlert',
  focus_reminder: 'focusReminder',
  weekly_report: 'weeklyReport',
};

exports.createNotification = async (userId, type, title, message, metadata = {}) => {
  try {
    const pref = PREFERENCE_FOR_TYPE[type];
    if (pref) {
      const user = await User.findById(userId).select('settings.notifications');
      if (user?.settings?.notifications?.[pref] === false) return null; // user opted out
    }
    return await Notification.create({ userId, type, title, message, metadata });
  } catch (error) {
    console.error('[Notifications] Create error:', error.message);
    return null;
  }
};
