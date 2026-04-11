const User = require('../models/User');
const CoinTransaction = require('../models/CoinTransaction');

// ────────────────────────────────────────────────────
// GET /api/coins/balance
// ────────────────────────────────────────────────────
exports.getBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      focusCoins: user.focusCoins,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
    });
  } catch (error) {
    console.error('[Coins] Balance error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/coins/history
// ────────────────────────────────────────────────────
exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 30, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = { userId: req.user._id };
    if (type) filter.type = type;

    const [transactions, total] = await Promise.all([
      CoinTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CoinTransaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('[Coins] History error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/coins/summary
// ────────────────────────────────────────────────────
exports.getSummary = async (req, res) => {
  try {
    const userId = req.user._id;

    const summary = await CoinTransaction.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      earned: { total: 0, count: 0 },
      spent: { total: 0, count: 0 },
      bonus: { total: 0, count: 0 },
      penalty: { total: 0, count: 0 },
    };

    summary.forEach((item) => {
      result[item._id] = { total: Math.abs(item.total), count: item.count };
    });

    res.json({ success: true, summary: result });
  } catch (error) {
    console.error('[Coins] Summary error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
