/**
 * AI assistant API (Gemini).
 *
 *   GET  /api/agent/status  — is the assistant on, the plan, and how many messages are left today
 *   POST /api/agent/chat    — one chat turn: { messages: [{ role, text }], timezone }
 *   GET  /api/agent/weekly-report?tz=&week=latest|YYYY-MM-DD — the AI weekly report
 *   GET  /api/agent/cron/weekly-emails — Vercel cron (daily): email opted-in users their finished week
 */

const { isConfigured } = require('../services/agent/geminiClient');
const { AgentError, GeminiError, chat, reserveMessage, refundMessage, remainingToday } = require('../services/agent/agentService');
const { planFor, PREMIUM_DAILY_CHATS } = require('../services/premium/planService');
const crypto = require('crypto');
const { getWeeklyReport, sendWeeklyEmails } = require('../services/agent/weeklyReportService');
const { resolveTimezone } = require('../services/streakService');

const NOT_CONFIGURED = { success: false, enabled: false, message: 'The AI assistant is not configured yet.' };

const firstNameOf = (user) => String(user?.name || '').trim().split(/\s+/)[0] || 'there';

// ────────────────────────────────────────────────────
// GET /api/agent/status
// ────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  try {
    const { plan, dailyLimit } = planFor(req.user);
    if (!isConfigured()) return res.json({ success: true, enabled: false, remainingToday: 0, dailyLimit: 0, plan });
    // No limit (owner): remainingToday and dailyLimit are null
    if (dailyLimit === null) return res.json({ success: true, enabled: true, remainingToday: null, dailyLimit: null, plan });
    const timezone = await resolveTimezone(req.user._id, req.query.tz);
    res.json({ success: true, enabled: true, remainingToday: await remainingToday(req.user._id, new Date(), timezone, dailyLimit), dailyLimit, plan });
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
  const { plan, dailyLimit } = planFor(req.user, now);
  let reserved = false;
  let timezone = 'UTC';
  try {
    timezone = await resolveTimezone(userId, req.body.timezone);
    // The owner has no limit, so nothing is counted
    const remaining = dailyLimit === null ? null : await reserveMessage(userId, now, timezone, dailyLimit);
    if (dailyLimit !== null && remaining === null) {
      return res.status(429).json({
        success: false,
        message: plan === 'free'
          ? `You've used your ${dailyLimit} free chats for today. Upgrade to Premium for ${PREMIUM_DAILY_CHATS} chats a day, or come back after midnight.`
          : `You've used all ${dailyLimit} chats for today. They reset at midnight.`,
        remainingToday: 0,
        plan,
        upgrade: plan === 'free',
      });
    }
    reserved = dailyLimit !== null;

    const result = await chat({ userId, firstName: firstNameOf(req.user), timezone, messages: req.body.messages, now });
    res.json({ success: true, reply: result.reply, proposals: result.proposals, usage: { remainingToday: remaining } });
  } catch (error) {
    if (reserved) await refundMessage(userId, now, timezone);
    if (error instanceof AgentError) return res.status(error.status).json({ success: false, message: error.message });
    if (error instanceof GeminiError) {
      console.error('[Agent] Gemini error:', error.message);
      return res.status(502).json({ success: false, message: 'The assistant is busy right now. Please try again in a moment.' });
    }
    console.error('[Agent] Chat error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/agent/weekly-report
// Works without Gemini too (plain template report).
// ────────────────────────────────────────────────────
exports.getWeeklyReport = async (req, res) => {
  try {
    const timezone = await resolveTimezone(req.user._id, req.query.tz);
    const result = await getWeeklyReport(req.user._id, { timezone, weekStart: req.query.week });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Agent] Weekly report error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ────────────────────────────────────────────────────
// GET /api/agent/cron/weekly-emails
// Called by Vercel Cron, which sends `Authorization: Bearer <CRON_SECRET>`.
// Without CRON_SECRET set, it refuses to run.
// ────────────────────────────────────────────────────
exports.runWeeklyEmails = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(String(req.headers.authorization || ''));
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const result = await sendWeeklyEmails();
    console.log('[Agent] Weekly emails:', JSON.stringify(result));
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Agent] Weekly emails error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
