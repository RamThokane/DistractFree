/**
 * AI assistant API (Gemini).
 *
 *   GET  /api/agent/status  — is the assistant on, and how many messages are left today
 *   POST /api/agent/chat    — one chat turn: { messages: [{ role, text }], timezone }
 */

const { isConfigured } = require('../services/agent/geminiClient');
const { AgentError, GeminiError, chat, reserveMessage, refundMessage, remainingToday, dailyLimit } = require('../services/agent/agentService');
const { resolveTimezone } = require('../services/streakService');

const NOT_CONFIGURED = { success: false, enabled: false, message: 'The AI assistant is not configured yet.' };

const firstNameOf = (user) => String(user?.name || '').trim().split(/\s+/)[0] || 'there';

// ────────────────────────────────────────────────────
// GET /api/agent/status
// ────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    if (!isConfigured()) return res.json({ success: true, enabled: false, remainingToday: 0, dailyLimit: 0 });
    res.json({ success: true, enabled: true, remainingToday: await remainingToday(req.user._id), dailyLimit: dailyLimit() });
  } catch (error) {
    console.error('[Agent] Status error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// POST /api/agent/chat
// ────────────────────────────────────────────────────
exports.chat = async (req, res) => {
  if (!isConfigured()) return res.status(503).json(NOT_CONFIGURED);

  const userId = req.user._id;
  const now = new Date();
  let reserved = false;
  try {
    const remaining = await reserveMessage(userId, now);
    if (remaining === null) {
      return res.status(429).json({
        success: false,
        message: `You've used all ${dailyLimit()} assistant messages for today. They reset at midnight UTC.`,
        remainingToday: 0,
      });
    }
    reserved = true;

    const timezone = await resolveTimezone(userId, req.body.timezone);
    const result = await chat({ userId, firstName: firstNameOf(req.user), timezone, messages: req.body.messages, now });
    res.json({ success: true, reply: result.reply, proposals: result.proposals, usage: { remainingToday: remaining } });
  } catch (error) {
    if (reserved) await refundMessage(userId, now);
    if (error instanceof AgentError) return res.status(error.status).json({ success: false, message: error.message });
    if (error instanceof GeminiError) {
      console.error('[Agent] Gemini error:', error.message);
      return res.status(502).json({ success: false, message: 'The assistant is busy right now. Please try again in a moment.' });
    }
    console.error('[Agent] Chat error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
