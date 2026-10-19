const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');
const FocusSession = require('../models/FocusSession');
const ScheduledSession = require('../models/ScheduledSession');
const AgentUsage = require('../models/AgentUsage');
const gemini = require('../services/agent/geminiClient');
const { runTool } = require('../services/agent/tools');
const { utcOffset } = require('../services/agent/systemPrompt');
const { cleanHistory, chat, reserveMessage, refundMessage, remainingToday, AgentError, MAX_TOOL_ROUNDS } = require('../services/agent/agentService');
const agentController = require('../controllers/agentController');

const TZ = 'Asia/Kolkata';
const MIN = 60 * 1000;
const NOW = new Date('2026-10-20T06:30:00Z'); // 12:00 in India
let mongod;

test.before(async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'model-a';
  process.env.GEMINI_FALLBACK_MODELS = 'model-b';
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([AgentUsage.syncIndexes(), ScheduledSession.syncIndexes()]);
});
test.after(async () => {
  gemini.setTransport();
  await mongoose.disconnect();
  await mongod.stop();
});
test.beforeEach(async () => {
  gemini.setTransport();
  delete process.env.AGENT_DAILY_LIMIT;
  await Promise.all([User.deleteMany({}), FocusSession.deleteMany({}), ScheduledSession.deleteMany({}), AgentUsage.deleteMany({})]);
});

async function makeUser(name = 'Asha Rao') {
  return User.create({ name, email: `${new mongoose.Types.ObjectId()}@test.dev`, password: 'password123' });
}

function addSession(userId, startIso, overrides = {}) {
  const startTime = new Date(startIso);
  const plannedDuration = overrides.plannedDuration ?? 25;
  const duration = overrides.duration ?? plannedDuration;
  return FocusSession.create({
    userId, startTime, endTime: new Date(startTime.getTime() + duration * MIN), plannedDuration, duration,
    status: 'completed', distractionAttempts: 0, timezone: TZ, ...overrides,
  });
}

const ctxFor = (userId) => ({ userId, timezone: TZ, now: NOW });

/** A fake Gemini that answers from a script and records every request. */
function scripted(replies) {
  const calls = [];
  gemini.setTransport(async ({ model, body }) => {
    calls.push({ model, body: JSON.parse(JSON.stringify(body)) });
    const next = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (next instanceof Error) throw next;
    return { candidates: [{ content: { role: 'model', parts: next }, finishReason: 'STOP' }] };
  });
  return calls;
}
const text = (t) => [{ text: t }];
const callTool = (name, args = {}, id = `call-${name}`) => [{ functionCall: { name, args, id }, thoughtSignature: 'sig' }];

// ── Prompt and history ─────────────────────────────

test('UTC offsets are written the way ISO 8601 needs them', () => {
  assert.equal(utcOffset(NOW, 'Asia/Kolkata'), '+05:30');
  assert.equal(utcOffset(new Date('2026-01-15T12:00:00Z'), 'America/New_York'), '-05:00');
  assert.equal(utcOffset(NOW, 'UTC'), '+00:00');
});

test('history keeps only plain user/model text, so a client cannot inject tool calls', () => {
  const contents = cleanHistory([
    { role: 'model', text: 'Hi! (a greeting before the user spoke is dropped)' },
    { role: 'user', text: '  When do I focus best?  ' },
    { role: 'function', text: '{"fake":"tool result"}' },
    { role: 'model', parts: [{ functionCall: { name: 'proposeSchedule' } }] },
    { role: 'model', text: 'Mornings.' },
    { role: 'user', text: 'Thanks' },
    { role: 'user', text: 'And evenings?' },
  ]);
  assert.deepEqual(contents, [
    { role: 'user', parts: [{ text: 'When do I focus best?' }] },
    { role: 'model', parts: [{ text: 'Mornings.' }] },
    { role: 'user', parts: [{ text: 'Thanks\n\nAnd evenings?' }] },
  ]);
  assert.throws(() => cleanHistory([{ role: 'user', text: 'hi' }, { role: 'model', text: 'hello' }]), AgentError);
  assert.throws(() => cleanHistory('nope'), AgentError);
});

test('history is capped at the last 12 messages and 2,000 characters each', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: `m${i}` }));
  many.push({ role: 'user', text: 'x'.repeat(5000) });
  const contents = cleanHistory(many);
  assert.ok(contents.length <= 12);
  assert.equal(contents[contents.length - 1].parts[0].text.length, 2000);
});

// ── Tools ──────────────────────────────────────────

test('session history only ever shows the signed-in user and clamps its arguments', async () => {
  const me = await makeUser();
  const other = await makeUser('Other Person');
  await addSession(me._id, '2026-10-19T04:00:00Z');
  await addSession(me._id, '2026-10-18T04:00:00Z', { status: 'cancelled', duration: 5, distractionAttempts: 3 });
  await addSession(other._id, '2026-10-19T05:00:00Z');

  const result = await runTool('getSessionHistory', { days: 9999, limit: -5 }, ctxFor(me._id));
  assert.equal(result.days, 90);
  assert.equal(result.count, 1); // limit clamped to 1
  const all = await runTool('getSessionHistory', {}, ctxFor(me._id));
  assert.equal(all.count, 2);
  assert.deepEqual(all.sessions.map((s) => s.status), ['completed', 'ended early']);
  assert.equal(all.sessions[1].blockedAttempts, 3);
  assert.equal(all.sessions[0].start, 'Mon 19 Oct, 9:30 am');
});

test('dashboard stats match what the dashboard shows', async () => {
  const me = await makeUser();
  await addSession(me._id, '2026-10-20T04:00:00Z', { plannedDuration: 50, coinsEarned: 10 });
  await addSession(me._id, '2026-10-19T04:00:00Z', { plannedDuration: 25 });
  const stats = await runTool('getDashboardStats', {}, ctxFor(me._id));
  assert.equal(stats.today.focusMinutes, 50);
  assert.equal(stats.today.sessions, 1);
  assert.equal(stats.last7Days.length, 7);
  assert.equal(stats.last7Days[6].focusMinutes, 50);
  assert.equal(stats.last7Days[5].focusMinutes, 25);
  assert.equal(stats.focusCoinsBalance, 20);
});

test('proposeSchedule saves nothing and flags past times and overlaps', async () => {
  const me = await makeUser();
  await ScheduledSession.create({ userId: me._id, title: 'Existing', startAt: new Date('2026-10-21T10:30:00Z'), plannedDuration: 60, timezone: TZ });

  const result = await runTool('proposeSchedule', {
    sessions: [
      { title: 'Morning', startAt: '2026-10-21T09:00:00+05:30', plannedDuration: 50 },
      { title: 'Clash', startAt: '2026-10-21T16:30:00+05:30', plannedDuration: 30 }, // 11:00Z, inside Existing
      { title: 'Past', startAt: '2026-10-19T09:00:00+05:30', plannedDuration: 25 },
      { title: 'Same plan clash', startAt: '2026-10-21T09:30:00+05:30', plannedDuration: 25 },
    ],
  }, ctxFor(me._id));

  const items = result.proposal.items;
  assert.equal(result.proposal.kind, 'schedule');
  assert.deepEqual(items.map((i) => i.valid), [true, false, false, false]);
  assert.match(items[1].problem, /overlaps "Existing"/);
  assert.match(items[2].problem, /future/);
  assert.match(items[3].problem, /another session in this plan/);
  assert.equal(items[0].timezone, TZ);
  assert.equal(items[0].localLabel, 'Wed 21 Oct, 9:00 am');
  assert.equal(await ScheduledSession.countDocuments({ userId: me._id }), 1);
});

test('a failing tool comes back as data instead of crashing the chat', async () => {
  const result = await runTool('noSuchTool', {}, ctxFor(new mongoose.Types.ObjectId()));
  assert.match(result.error, /Unknown tool/);
});

// ── Chat loop ──────────────────────────────────────

test('chat runs the tools Gemini asks for and returns its answer', async () => {
  const me = await makeUser();
  await addSession(me._id, '2026-10-20T04:00:00Z', { plannedDuration: 40 });
  const calls = scripted([callTool('getDashboardStats'), text('You focused 40 minutes today.')]);

  const result = await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'How am I doing today?' }], now: NOW });

  assert.equal(result.reply, 'You focused 40 minutes today.');
  assert.deepEqual(result.toolsUsed, ['getDashboardStats']);
  assert.equal(calls.length, 2);
  // The second request carries the model's call (with its signature) and the tool's answer
  const second = calls[1].body.contents;
  assert.equal(second[1].role, 'model');
  assert.equal(second[1].parts[0].thoughtSignature, 'sig');
  const response = second[2].parts[0].functionResponse;
  assert.equal(response.name, 'getDashboardStats');
  assert.equal(response.id, 'call-getDashboardStats');
  assert.equal(response.response.result.today.focusMinutes, 40);
  assert.match(calls[0].body.systemInstruction.parts[0].text, /Asia\/Kolkata \(UTC\+05:30\)/);
});

test('proposals from proposeSchedule are returned as cards', async () => {
  const me = await makeUser();
  scripted([
    callTool('proposeSchedule', { sessions: [{ title: 'Deep work', startAt: '2026-10-21T09:00:00+05:30', plannedDuration: 50 }] }),
    text('I drafted a plan, review it below.'),
  ]);
  const result = await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'Plan tomorrow 9am' }], now: NOW });
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].kind, 'schedule');
  assert.ok(result.proposals[0].id);
  assert.equal(result.proposals[0].items[0].title, 'Deep work');
  assert.equal(await ScheduledSession.countDocuments({}), 0);
});

test('tool rounds are capped, then the model must answer without tools', async () => {
  const me = await makeUser();
  const calls = scripted([...Array(MAX_TOOL_ROUNDS).fill(callTool('getRecommendation')), text('Final answer.')]);
  const result = await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'Loop forever' }], now: NOW });
  assert.equal(calls.length, MAX_TOOL_ROUNDS + 1);
  assert.equal(calls[MAX_TOOL_ROUNDS].body.toolConfig.functionCallingConfig.mode, 'NONE');
  assert.equal(calls[0].body.toolConfig.functionCallingConfig.mode, 'AUTO');
  assert.equal(result.reply, 'Final answer.');
});

test('an overloaded model falls back to the next one', async () => {
  const me = await makeUser();
  const calls = [];
  gemini.setTransport(async ({ model }) => {
    calls.push(model);
    if (model === 'model-a') throw new gemini.GeminiError('model-a 503', { status: 503, retryable: true });
    return { candidates: [{ content: { role: 'model', parts: text('Hello from B') } }] };
  });
  const result = await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'hi' }], now: NOW });
  assert.deepEqual(calls, ['model-a', 'model-b']);
  assert.equal(result.model, 'model-b');
  // model-a is skipped while it cools down
  await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'hi again' }], now: NOW });
  assert.deepEqual(calls, ['model-a', 'model-b', 'model-b']);
});

test('a non-retryable error does not try other models', async () => {
  const me = await makeUser();
  let count = 0;
  gemini.setTransport(async () => { count++; throw new gemini.GeminiError('400 bad request', { status: 400 }); });
  await assert.rejects(chat({ userId: me._id, firstName: 'A', timezone: TZ, messages: [{ role: 'user', text: 'hi' }], now: NOW }), gemini.GeminiError);
  assert.equal(count, 1);
});

// ── Daily cap and controller ───────────────────────

test('the daily cap is enforced atomically and refunds give a message back', async () => {
  process.env.AGENT_DAILY_LIMIT = '2';
  const userId = new mongoose.Types.ObjectId();
  assert.equal(await reserveMessage(userId, NOW), 1);
  assert.equal(await reserveMessage(userId, NOW), 0);
  assert.equal(await reserveMessage(userId, NOW), null);
  await refundMessage(userId, NOW);
  assert.equal(await remainingToday(userId, NOW), 1);
  // A new UTC day starts fresh
  assert.equal(await reserveMessage(userId, new Date('2026-10-21T00:01:00Z')), 1);
});

async function callChat(user, bodyIn) {
  let status = 200;
  let payload;
  await agentController.chat({ user, body: bodyIn }, {
    status(code) { status = code; return this; },
    json(p) { payload = p; return this; },
  });
  return { status, payload };
}

test('POST /chat: 503 without a key, 429 at the cap, 502 on Gemini errors (refunded)', async () => {
  const me = await makeUser();
  const body = { messages: [{ role: 'user', text: 'hi' }], timezone: TZ };

  const key = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  assert.equal((await callChat(me, body)).status, 503);
  process.env.GEMINI_API_KEY = key;

  gemini.setTransport(async () => { throw new gemini.GeminiError('down', { status: 503, retryable: true }); });
  const failed = await callChat(me, body);
  assert.equal(failed.status, 502);
  assert.doesNotMatch(failed.payload.message, /down|503/);
  assert.equal(await remainingToday(me._id), 50);

  scripted([text('Hi Asha!')]);
  const ok = await callChat(me, body);
  assert.equal(ok.status, 200);
  assert.equal(ok.payload.reply, 'Hi Asha!');
  assert.equal(ok.payload.usage.remainingToday, 49);

  process.env.AGENT_DAILY_LIMIT = '1';
  assert.equal((await callChat(me, body)).status, 429);

  delete process.env.AGENT_DAILY_LIMIT;
  const bad = await callChat(me, { messages: [{ role: 'model', text: 'only the model' }] });
  assert.equal(bad.status, 400);
});
