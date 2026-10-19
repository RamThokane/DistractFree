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
  await Promise.all([User.deleteMany({}), FocusSession.deleteMany({}), ScheduledSession.deleteMany({}), AgentUsage.deleteMany({}), mongoose.model('BlockedWebsite').deleteMany({}), mongoose.model('BrowsingLog').deleteMany({}), mongoose.model('CoinTransaction').deleteMany({})]);
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
  assert.equal(await reserveMessage(userId, NOW, TZ), 1);
  assert.equal(await reserveMessage(userId, NOW, TZ), 0);
  assert.equal(await reserveMessage(userId, NOW, TZ), null);
  await refundMessage(userId, NOW, TZ);
  assert.equal(await remainingToday(userId, NOW, TZ), 1);
  // The cap resets at the user's midnight: 00:10 IST is still 20 Oct in UTC, but a new day in India
  assert.equal(await reserveMessage(userId, new Date('2026-10-20T18:40:00Z'), TZ), 1);
  // (counted in UTC it would still be 20 Oct, sharing the old day's last message)
  assert.equal(await reserveMessage(userId, new Date('2026-10-20T18:40:00Z'), 'UTC'), 0);
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
  assert.equal(await remainingToday(me._id, new Date(), TZ), 50);

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

// ── Blocklist (phase 3) ────────────────────────────

const BlockedWebsite = require('../models/BlockedWebsite');
const BrowsingLog = require('../models/BrowsingLog');
const CoinTransaction = require('../models/CoinTransaction');
const { normaliseWebsiteUrl, isValidDomain, guessCategory } = require('../utils/websiteUrl');
const websiteController = require('../controllers/websiteController');

test('website addresses are normalised the same way everywhere', () => {
  assert.equal(normaliseWebsiteUrl('https://www.YouTube.com/'), 'youtube.com');
  assert.equal(normaliseWebsiteUrl('  http://News.YCombinator.com// '), 'news.ycombinator.com');
  assert.ok(isValidDomain('news.ycombinator.com'));
  assert.ok(!isValidDomain('youtube.com/watch?v=1'));
  assert.ok(!isValidDomain('not a site'));
  assert.ok(!isValidDomain('localhost'));
  assert.equal(guessCategory('m.youtube.com'), 'streaming');
  assert.equal(guessCategory('example.org'), 'other');
});

async function seedBlocklist(userId) {
  const yt = await BlockedWebsite.create({ userId, websiteUrl: 'youtube.com', category: 'streaming', isActive: true });
  const ig = await BlockedWebsite.create({ userId, websiteUrl: 'instagram.com', category: 'social_media', isActive: false });
  return { yt, ig };
}

test('getBlocklist reports sites, strict mode, unlocks and unblocked distractions', async () => {
  const me = await makeUser();
  await seedBlocklist(me._id);
  const at = new Date('2026-10-15T10:00:00Z');
  await BrowsingLog.create([
    { userId: me._id, website: 'youtube.com', timestamp: at, wasBlocked: true, duration: 0 },
    { userId: me._id, website: 'm.youtube.com', timestamp: at, wasBlocked: true, duration: 0 },
    { userId: me._id, website: 'reddit.com', timestamp: at, wasBlocked: false, duration: 600, category: 'social_media' },
    { userId: me._id, website: 'docs.google.com', timestamp: at, wasBlocked: false, duration: 900, category: 'other' },
  ]);
  await CoinTransaction.create([
    { userId: me._id, type: 'spent', amount: -5, balanceAfter: 15, description: 'Unlocked youtube.com during focus session', createdAt: at },
    { userId: me._id, type: 'spent', amount: -5, balanceAfter: 10, description: 'Unlocked youtube.com', createdAt: at },
  ]);
  const other = await makeUser('Other');
  await BlockedWebsite.create({ userId: other._id, websiteUrl: 'netflix.com' });

  const r = await runTool('getBlocklist', {}, ctxFor(me._id));
  assert.equal(r.strictMode, false);
  assert.equal(r.coinUnlocksLast30Days, 2);
  assert.deepEqual(r.blockedSites.map((s) => s.site).sort(), ['instagram.com', 'youtube.com']);
  const yt = r.blockedSites.find((s) => s.site === 'youtube.com');
  assert.equal(yt.blockedVisitsLast30Days, 2); // youtube.com + m.youtube.com
  assert.equal(yt.coinUnlocksLast30Days, 2);
  assert.equal(r.blockedSites.find((s) => s.site === 'instagram.com').enabled, false);
  assert.deepEqual(r.visitedDuringSessionsButNotBlocked.map((s) => s.site), ['reddit.com']);
});

test('proposeBlocklistChange checks every change and saves nothing', async () => {
  const me = await makeUser();
  await seedBlocklist(me._id);
  const r = await runTool('proposeBlocklistChange', {
    changes: [
      { action: 'add', websiteUrl: 'https://www.Reddit.com/', reason: 'You visited it 12 times in sessions' },
      { action: 'add', websiteUrl: 'youtube.com', reason: 'x' },
      { action: 'add', websiteUrl: 'instagram.com', reason: 'x' },
      { action: 'enable', websiteUrl: 'instagram.com', reason: 'x' },
      { action: 'remove', websiteUrl: 'youtube.com', reason: 'x' },
      { action: 'disable', websiteUrl: 'netflix.com', reason: 'x' },
      { action: 'add', websiteUrl: 'reddit.com', reason: 'duplicate' },
      { action: 'add', websiteUrl: 'not a site', reason: 'x' },
      { action: 'explode', websiteUrl: 'x.com', reason: 'x' },
    ],
    strictMode: true,
  }, ctxFor(me._id));

  const c = r.proposal.changes;
  assert.equal(r.proposal.kind, 'blocklist');
  assert.deepEqual(c.map((x) => x.valid), [true, false, false, true, true, false, false, false, false]);
  assert.equal(c[0].site, 'reddit.com');
  assert.equal(c[0].category, 'social_media');
  assert.equal(c[0].reason, 'You visited it 12 times in sessions');
  assert.equal(c[1].problem, 'Already blocked');
  assert.match(c[2].problem, /enable it instead/);
  assert.ok(c[3].websiteId);
  assert.equal(c[5].problem, 'Not on your blocked list');
  assert.equal(c[6].problem, 'Listed twice in this plan');
  assert.equal(c[7].problem, 'Not a valid website address');
  assert.equal(c[8].problem, 'Unknown action');
  assert.deepEqual(r.proposal.strictMode, { to: true, current: false, valid: true, problem: null });

  // Nothing changed
  assert.equal(await BlockedWebsite.countDocuments({ userId: me._id }), 2);
  assert.equal((await BlockedWebsite.findOne({ userId: me._id, websiteUrl: 'instagram.com' })).isActive, false);
  assert.equal((await User.findById(me._id)).settings.strictMode, false);

  const same = await runTool('proposeBlocklistChange', { strictMode: false }, ctxFor(me._id));
  assert.equal(same.proposal.strictMode.valid, false);
  assert.match((await runTool('proposeBlocklistChange', {}, ctxFor(me._id))).error, /at least one/);
});

test('applying a confirmed change only ever touches your own sites', async () => {
  const me = await makeUser();
  const other = await makeUser('Other');
  const { yt } = await seedBlocklist(other._id);
  let status = 200;
  await websiteController.toggleWebsite({ user: { _id: me._id }, params: { id: String(yt._id) } }, {
    status(code) { status = code; return this; },
    json() { return this; },
  });
  assert.equal(status, 404);
  assert.equal((await BlockedWebsite.findById(yt._id)).isActive, true);
});

test('a reply that points to cards without proposing anything gets one nudge', async () => {
  const me = await makeUser();
  const calls = scripted([
    text('Review the changes below and press Apply.'),
    callTool('proposeBlocklistChange', { changes: [{ action: 'add', websiteUrl: 'reddit.com', reason: 'x' }] }),
    text('I drafted the change; tick it and press Apply.'),
  ]);
  const result = await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'What should I block?' }], now: NOW });
  assert.equal(calls.length, 3);
  assert.match(calls[1].body.contents[calls[1].body.contents.length - 1].parts[0].text, /did not call a propose tool/);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].kind, 'blocklist');

  // Only once: a second reply like that is accepted as it is
  const again = scripted([text('See the cards below.'), text('Still see the cards below.')]);
  const r2 = await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'hm' }], now: NOW });
  assert.equal(again.length, 2);
  assert.equal(r2.reply, 'Still see the cards below.');

  // Ordinary answers aren't touched
  const plain = scripted([text('Mornings are your best time.')]);
  await chat({ userId: me._id, firstName: 'Asha', timezone: TZ, messages: [{ role: 'user', text: 'When?' }], now: NOW });
  assert.equal(plain.length, 1);
});
