/* ═══════════════════════════════════════════════════════════
   Product-demo timeline (seconds).
   Everything the demo shows is a pure function of the clock `t`
   — page scroll never feeds into it.
   ═══════════════════════════════════════════════════════════ */

import { SESSION_PRESETS, UNLOCK_COST, calculateCoins } from '../../utils/coinRules';

export const TOTAL_DURATION = 48;

/* ── Demo account (sample values, not real user data) ── */
const SESSION = SESSION_PRESETS[0]; // 25 min Pomodoro
export const DEMO_USER = { name: 'Alex', streak: 2 };
export const START_BALANCE = 340;
const DISTRACTION_ATTEMPTS = 1; // the instagram.com visit
export const REWARD = calculateCoins(SESSION.seconds / 60, DEMO_USER.streak, DISTRACTION_ATTEMPTS);
export const SESSION_LABEL = SESSION.label;
export const SESSION_SECONDS = SESSION.seconds;

/* ── Key moments ── */
export const T = {
  presetHover: 1.9,
  startClick: 3.3,
  extClick: 6.5,
  popupOpen: 6.6,
  popupClose: 9.5,
  omni1Click: 10.8,
  type1: [11.1, 12.3],
  enter1: 12.5,
  socialIn: 13.1,
  detect: 14.2,
  block1In: 15.0,
  unlockHover1: [16.5, 17.5],
  returnClick: 18.8,
  focusBackIn: 19.4,
  fastForward: [20.8, 23.4],
  complete: 23.4,
  reward: [24.0, 26.0],
  coinFly: [26.0, 26.8],
  earnCount: [26.7, 27.3],
  omni2Click: 28.2,
  type2: [28.5, 29.4],
  enter2: 29.6,
  block2In: 30.1,
  unlockClick: 31.9,
  unlocked: 32.4,
  spendCount: [32.5, 33.0],
  redirect: 33.4,
  videoIn: 33.9,
  omni3Click: 35.9,
  type3: [36.2, 36.6],
  enter3: 37.0,
  insightsIn: 37.5,
  insightsCount: [37.9, 39.4],
  insightsChart: [38.8, 40.2],
  insightsScroll: [41.2, 42.4],
  insightsRecs: 42.2,
  outro: 46.8,
};

/* ── Chapters → the six steps on the left ── */
export const STEPS = [
  { num: '01', label: 'Start Focus Session', caption: 'Pick a preset and press Start — the session timer begins.', start: 0, end: 6.2 },
  { num: '02', label: 'Extension Activates', caption: 'The Chrome extension syncs the session and starts protecting you.', start: 6.2, end: 10.6 },
  { num: '03', label: 'Distractions Blocked', caption: 'Blocked sites are intercepted with a calm, motivating pause page.', start: 10.6, end: 19.4 },
  { num: '04', label: 'Earn Focus Coins', caption: 'Finish the session and coins land in your balance.', start: 19.4, end: 27.9 },
  { num: '05', label: 'Unlock Intentionally', caption: 'Need a break? Spend coins to unlock a site on purpose.', start: 27.9, end: 35.8 },
  { num: '06', label: 'AI Insights', caption: 'See when you focus best and when distraction risk rises.', start: 35.8, end: TOTAL_DURATION },
];

/* ── Math helpers ── */
export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
export const easeOut = (p) => 1 - Math.pow(1 - p, 3);
export const inRange = (t, [a, b]) => t >= a && t < b;

/* ── Derived app state ── */
const FF_FROM = SESSION_SECONDS - Math.floor(T.fastForward[0] - T.startClick);

/** Seconds left in the focus session at demo time t. Real time, then a visible fast-forward. */
export const sessionRemaining = (t) => {
  if (t < T.startClick) return SESSION_SECONDS;
  if (t < T.fastForward[0]) return SESSION_SECONDS - Math.floor(t - T.startClick);
  if (t < T.fastForward[1]) {
    const p = easeInOut(seg(t, T.fastForward[0], T.fastForward[1]));
    return Math.max(0, Math.round(FF_FROM * (1 - p)));
  }
  return 0;
};

export const sessionActive = (t) => t >= T.startClick && t < T.complete;

export const coinBalance = (t) => {
  const earned = START_BALANCE + Math.round(REWARD.totalCoins * seg(t, ...T.earnCount));
  return earned - Math.round(UNLOCK_COST * seg(t, ...T.spendCount));
};

/* ── Which page the browser shows ── */
export const screenAt = (t) => {
  if (t < T.socialIn) return 'focus';
  if (t < T.block1In) return 'social';
  if (t < T.focusBackIn) return 'block-instagram';
  if (t < T.block2In) return 'focus';
  if (t < T.videoIn) return 'block-youtube';
  if (t < T.insightsIn) return 'video';
  return 'insights';
};

const PAGES = {
  focus: { url: 'app.distractfree.com/focus', title: 'DistractFree — Focus', icon: 'df' },
  social: { url: 'instagram.com', title: 'Instagram', icon: 'social' },
  'block-instagram': { url: 'instagram.com', title: 'Stay Focused', icon: 'shield' },
  'block-youtube': { url: 'youtube.com', title: 'Stay Focused', icon: 'shield' },
  video: { url: 'youtube.com/watch', title: 'YouTube', icon: 'video' },
  insights: { url: 'app.distractfree.com/insights', title: 'DistractFree — AI Insights', icon: 'df' },
};

/* Page loads: [start, end] of the progress bar */
const LOADS = [
  [0, 0.6],
  [T.enter1, T.socialIn],
  [T.returnClick + 0.1, T.focusBackIn],
  [T.enter2, T.block2In],
  [T.redirect, T.videoIn],
  [T.enter3, T.insightsIn],
];

/* Omnibox edits: click → type → enter */
const EDITS = [
  { click: T.omni1Click, type: T.type1, enter: T.enter1, text: 'instagram.com' },
  { click: T.omni2Click, type: T.type2, enter: T.enter2, text: 'youtube.com' },
  { click: T.omni3Click, type: T.type3, enter: T.enter3, text: 'app.d', complete: 'istractfree.com/insights' },
];

/**
 * Everything the browser chrome needs at time t.
 * `instant` (reduced motion) skips the per-character typing.
 */
export const browserAt = (t, instant = false) => {
  const page = PAGES[screenAt(t)];
  const load = LOADS.find(([a, b]) => t >= a && t < b);
  const edit = EDITS.find((e) => t >= e.click && t < e.enter);

  let omnibox = { text: page.url, focused: false, selected: false, completion: '' };
  if (edit) {
    const typedChars = instant ? edit.text.length : Math.floor(seg(t, ...edit.type) * edit.text.length);
    const typing = t >= edit.type[0];
    omnibox = {
      text: typing ? edit.text.slice(0, Math.max(typedChars, 0)) : page.url,
      focused: true,
      selected: !typing,
      completion: edit.complete && typedChars >= edit.text.length ? edit.complete : '',
    };
  }

  return {
    ...page,
    omnibox,
    loading: Boolean(load),
    loadProgress: load ? easeOut(seg(t, load[0], load[1])) : 0,
    canGoBack: t >= T.socialIn,
    extensionOn: sessionActive(t),
    extensionAlert: inRange(t, [T.detect, T.block1In + 0.4]) || inRange(t, [T.enter2, T.block2In + 0.5]),
    popupOpen: inRange(t, [T.popupOpen, T.popupClose]),
  };
};

/* ═══════════════════════════════════════════════════════════
   Cursor script
   A move glides from wherever the cursor is to `to` between
   `start` and `end`. `to` is a data-demo-target name (measured
   from the DOM, so it follows responsive layouts) or {x, y} in %.
   ═══════════════════════════════════════════════════════════ */
export const CURSOR_MOVES = [
  { start: 0, end: 0, to: { x: 72, y: 70 } },
  { start: 0.9, end: 1.9, to: 'preset-25', kind: 'hand' },
  { start: 2.4, end: 3.15, to: 'start-focus', kind: 'hand' },
  { start: 3.8, end: 4.9, to: { x: 64, y: 58 } },
  { start: 5.6, end: 6.35, to: 'ext-icon', kind: 'hand' },
  { start: 7.1, end: 8.1, to: 'popup-timer' },
  { start: 8.7, end: 9.35, to: { x: 34, y: 62 } },
  { start: 10.0, end: 10.7, to: 'omnibox', kind: 'text' },
  { start: 13.2, end: 13.2, to: { x: 55, y: 55 } },
  { start: 13.3, end: 14.3, to: { x: 52, y: 66 } },
  { start: 15.6, end: 16.5, to: 'unlock-btn', kind: 'hand' },
  { start: 17.6, end: 18.6, to: 'return-btn', kind: 'hand' },
  { start: 19.6, end: 20.5, to: { x: 80, y: 78 } },
  { start: 26.6, end: 26.6, to: { x: 62, y: 72 } },
  { start: 27.3, end: 28.1, to: 'omnibox', kind: 'text' },
  { start: 30.6, end: 30.6, to: { x: 60, y: 30 } },
  { start: 30.9, end: 31.75, to: 'unlock-btn', kind: 'hand' },
  { start: 32.8, end: 33.4, to: { x: 66, y: 74 } },
  { start: 34.3, end: 35.1, to: { x: 40, y: 45 } },
  { start: 35.3, end: 35.85, to: 'omnibox', kind: 'text' },
  { start: 38.1, end: 38.1, to: { x: 62, y: 70 } },
  { start: 38.3, end: 39.2, to: 'insight-risk' },
  { start: 40.3, end: 41.1, to: 'insight-best-hours' },
  { start: 42.8, end: 43.8, to: 'insight-rec' },
  { start: 44.6, end: 45.4, to: { x: 78, y: 60 } },
];

export const CURSOR_CLICKS = [T.startClick, T.extClick, T.popupClose, T.omni1Click, T.returnClick, T.omni2Click, T.unlockClick, T.omni3Click];

/* Periods when the pointer is hidden (typing, time-lapse, outro) */
export const CURSOR_HIDDEN = [
  [-1, 0.4],
  [11.0, 13.2],
  [20.9, 26.6],
  [28.4, 30.6],
  [36.1, 38.1],
  [45.8, TOTAL_DURATION + 1],
];
