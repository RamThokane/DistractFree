/**
 * AI assistant — one chat turn.
 *
 * Stateless, so it works on serverless: the website sends the recent
 * conversation as plain text, and all tool calls happen inside this one
 * request. Only plain user/model text is accepted from the client, so a client
 * can't slip in fake tool calls or tool results.
 *
 *   user message → Gemini ⇄ tools (≤ MAX_TOOL_ROUNDS) → reply + proposals
 *
 * Proposals (sessions to schedule, blocklist changes) are returned to the
 * website as cards; nothing changes until the user confirms one.
 */

const crypto = require('crypto');
const AgentUsage = require('../../models/AgentUsage');
const { generate, GeminiError } = require('./geminiClient');
const { DECLARATIONS, runTool } = require('./tools');
const { buildSystemPrompt } = require('./systemPrompt');

const MAX_TOOL_ROUNDS = 5;
const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 2000;
const RETRY_PAUSE_MS = 1500;
// A reply that sends the user to proposal cards ("review the changes below and press Apply")
const PROMISES_CARDS = /\b(below|press (apply|confirm)|cards?)\b/i;
const NUDGE = '(System check, not from the user: your reply refers to changes or cards below, but you did not call a propose tool, so the user sees nothing to confirm. Call proposeSchedule or proposeBlocklistChange now, or answer again without mentioning cards.)';

class AgentError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** The user's local calendar day, YYYY-MM-DD, so the cap resets at their midnight. */
const localDay = (now, tz) => {
  try {
    return now.toLocaleDateString('en-CA', { timeZone: tz || 'UTC' });
  } catch {
    return now.toISOString().slice(0, 10);
  }
};

// ── Daily cap ──────────────────────────────────────

/**
 * Count one message against today's cap (the user's plan sets `limit`).
 * @returns {Promise<number|null>} messages left today, or null if the cap is reached
 */
async function reserveMessage(userId, now, tz, limit) {
  try {
    // Matches only while under the cap; at the cap the upsert's insert hits the
    // unique { userId, day } index, which is how "full" is detected atomically.
    const doc = await AgentUsage.findOneAndUpdate(
      { userId, day: localDay(now, tz), count: { $lt: limit } },
      { $inc: { count: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return Math.max(0, limit - doc.count);
  } catch (err) {
    if (err.code === 11000) return null;
    throw err;
  }
}

/** Give a message back when the assistant failed to answer it. */
async function refundMessage(userId, now = new Date(), tz = 'UTC') {
  await AgentUsage.updateOne({ userId, day: localDay(now, tz), count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => {});
}

async function remainingToday(userId, now, tz, limit) {
  const doc = await AgentUsage.findOne({ userId, day: localDay(now, tz) }).select('count').lean();
  return Math.max(0, limit - (doc?.count || 0));
}

// ── Conversation ───────────────────────────────────

/** generate(), tried once more after a short pause if every model was busy. */
async function generateWithRetry(req) {
  try {
    return await generate(req);
  } catch (err) {
    if (!(err instanceof GeminiError) || !err.retryable) throw err;
    console.error('[Agent] All models busy, retrying once:', err.message);
    await new Promise((r) => setTimeout(r, Number(process.env.AGENT_RETRY_PAUSE_MS ?? RETRY_PAUSE_MS)));
    return generate(req);
  }
}

/** The client's messages as Gemini contents: plain text only, last MAX_HISTORY, starting and ending with the user. */
function cleanHistory(messages) {
  if (!Array.isArray(messages)) throw new AgentError(400, 'messages must be a list');
  const turns = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.role, text: m.text.trim().slice(0, MAX_MESSAGE_CHARS) }))
    .slice(-MAX_HISTORY);
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') throw new AgentError(400, 'The last message must be from you');

  // Merge back-to-back turns from the same side (e.g. a retried message)
  const merged = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.parts[0].text += `\n\n${t.text}`;
    else merged.push({ role: t.role, parts: [{ text: t.text }] });
  }
  return merged;
}

/**
 * Answer the last user message.
 *
 * @param {object} input
 * @param {ObjectId} input.userId
 * @param {string}   input.firstName
 * @param {string}   input.timezone  valid IANA timezone
 * @param {object[]} input.messages  [{ role: 'user'|'model', text }]
 * @returns {Promise<{ reply: string, proposals: object[], toolsUsed: string[], model: string }>}
 */
async function chat({ userId, firstName, timezone, messages, now = new Date() }) {
  const contents = cleanHistory(messages);
  const systemInstruction = buildSystemPrompt({ firstName, timezone, now });
  const ctx = { userId, timezone, now };

  const proposals = [];
  const toolsUsed = [];
  let reply = '';
  let model = null;

  let nudged = false;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Last round: tools off, so the model has to answer with what it has
    const res = await generateWithRetry({ systemInstruction, contents, tools: DECLARATIONS, toolMode: round < MAX_TOOL_ROUNDS ? 'AUTO' : 'NONE' });
    model = res.model;
    if (!res.functionCalls.length || round === MAX_TOOL_ROUNDS) {
      // Talks about cards to confirm, but proposed nothing: ask once to fix that
      if (!proposals.length && !nudged && round < MAX_TOOL_ROUNDS && PROMISES_CARDS.test(res.text)) {
        nudged = true;
        contents.push(res.content, { role: 'user', parts: [{ text: NUDGE }] });
        continue;
      }
      reply = res.text;
      break;
    }

    // Keep the model's turn exactly as sent (it carries thought signatures)
    contents.push(res.content);
    const responses = [];
    for (const call of res.functionCalls) {
      const result = await runTool(call.name, call.args, ctx);
      toolsUsed.push(call.name);
      if (result?.proposal) proposals.push({ id: crypto.randomUUID(), ...result.proposal });
      responses.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: { result } } });
    }
    contents.push({ role: 'user', parts: responses });
  }

  if (!reply) {
    reply = proposals.length
      ? 'Here is a plan. Review the cards below and press Confirm for the ones you want.'
      : "Sorry, I couldn't put an answer together. Could you try asking another way?";
  }
  return { reply, proposals, toolsUsed, model };
}

module.exports = {
  AgentError,
  GeminiError,
  MAX_TOOL_ROUNDS,
  MAX_HISTORY,
  reserveMessage,
  refundMessage,
  remainingToday,
  cleanHistory,
  chat,
};
