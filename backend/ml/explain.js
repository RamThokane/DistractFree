/**
 * Explanations derived from the model itself.
 *
 * - explainPath():          decision tree — turns the nodes a prediction
 *                           passed through into human-readable reasons. Each
 *                           reason's effect is the change in success rate
 *                           between a node and the child the session went to.
 * - explainContributions(): logistic regression — one reason per input, from
 *                           its term coef · scaled value. Each reason's effect
 *                           is how much the probability would drop or rise if
 *                           that input were at the training average instead.
 * - bestCounterfactual():   re-runs the same model with only the things a
 *                           user controls changed (start hour, planned duration).
 *
 * Nothing here contains rules of its own: no thresholds, no opinions about
 * what is good or bad. It only reports what the model did.
 */

const { applyControllable, bandOfHour, MINUTES_SINCE_LAST_CAP } = require('./featureBuilder');
const { predict } = require('./activeModel');
const { sigmoid } = require('./logisticRegressionModel');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COUNTERFACTUAL_DURATIONS = [25, 45, 60];
const COUNTERFACTUAL_MAX_HOURS = 3;
const MIN_COUNTERFACTUAL_GAIN = 0.03;
// A step that moves the success rate by less than this is reported as neutral
const NEUTRAL_DELTA = 0.005;

const pct = (x) => `${Math.round(x * 100)}%`;
const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
const oneDecimal = (x) => String(Math.round(x * 10) / 10);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const gap = (minutes) => {
  if (minutes >= MINUTES_SINCE_LAST_CAP) return '24+ hours';
  return minutes < 60 ? `${Math.round(minutes)} min` : `${oneDecimal(minutes / 60)} h`;
};

/**
 * How each feature is worded.
 *   label     short name for UI chips
 *   format    value → text
 *   sentence  (formatted value, all features) → sentence stem
 *   integer   whole-number feature: "> 2.5" is shown as "≥ 3"
 *   bound     optional custom wording of a threshold side
 */
const FEATURE_TEXT = {
  hourOfDay: {
    label: 'Start time',
    integer: true,
    format: hourLabel,
    sentence: (v) => `You're starting at ${v}`,
    bound: (direction, limit) => (direction === '<=' ? `before ${hourLabel((limit + 1) % 24)}` : `${hourLabel(limit)} or later`),
  },
  dayOfWeek: {
    label: 'Day of week',
    integer: true,
    format: (v) => DAY_NAMES[v],
    sentence: (v) => `Today is ${v}`,
    bound: (direction, limit) => (direction === '<=' ? `Sun–${DAY_SHORT[limit]}` : `${DAY_SHORT[limit]}–Sat`),
  },
  isWeekend: {
    label: 'Weekend',
    integer: true,
    format: (v) => (v ? 'weekend' : 'weekday'),
    sentence: (v) => `It's a ${v}`,
    bound: () => null,
  },
  plannedDuration: {
    label: 'Planned length',
    integer: true,
    format: (v) => `${v} min`,
    sentence: (v) => `You planned a ${v} session`,
  },
  successRateLast5: {
    label: 'Last 5 sessions',
    format: pct,
    sentence: (v) => `Your success rate over the last 5 sessions is ${v}`,
  },
  successRateLast20: {
    label: 'Last 20 sessions',
    format: pct,
    sentence: (v) => `Your success rate over the last 20 sessions is ${v}`,
  },
  avgDistractionsLast5: {
    label: 'Recent blocked-site attempts',
    format: oneDecimal,
    sentence: (v) => `You averaged ${v} blocked-site attempts per session over your last 5 sessions`,
  },
  avgTabSwitchesLast5: {
    label: 'Recent tab switches',
    format: oneDecimal,
    sentence: (v) => `You averaged ${v} tab switches per session over your last 5 sessions`,
  },
  currentStreak: {
    label: 'Streak',
    integer: true,
    format: (v) => plural(v, 'day'),
    sentence: (v) => `Your streak is ${v}`,
  },
  minutesSinceLastSession: {
    label: 'Time since last session',
    format: gap,
    sentence: (v) => `Your last session ended ${v} ago`,
  },
  sessionsAlreadyToday: {
    label: 'Sessions today',
    integer: true,
    format: (v) => String(v),
    sentence: (v, f) => `You've already done ${plural(f.sessionsAlreadyToday, 'session')} today`,
  },
  hourBandSuccessRate: {
    label: 'This time of day',
    format: pct,
    sentence: (v, f) => `Your past success rate in the ${bandOfHour(f.hourOfDay).label} is ${v}`,
  },
  hasHistory: {
    label: 'History',
    integer: true,
    format: (v) => (v ? 'has history' : 'first session'),
    sentence: (_v, f) => (f.hasHistory ? 'You have earlier sessions to learn from' : 'This is your first session'),
    bound: () => null,
  },
};

/** "≤ 55%" / "≥ 3 days" — the side of the split this session fell on. */
function conditionText(step) {
  const spec = FEATURE_TEXT[step.feature];
  if (spec.integer) {
    const limit = step.direction === '<=' ? Math.floor(step.threshold) : Math.floor(step.threshold) + 1;
    if (spec.bound) return spec.bound(step.direction, limit);
    return `${step.direction === '<=' ? '≤' : '≥'} ${spec.format(limit)}`;
  }
  return `${step.direction === '<=' ? '≤' : '>'} ${spec.format(step.threshold)}`;
}

const effectOf = (delta) => (Math.abs(delta) < NEUTRAL_DELTA ? 'neutral' : delta > 0 ? 'raises' : 'lowers');

/** One reason in the shape every caller and the UI expect. */
function toReason(feature, delta, condition, features) {
  const spec = FEATURE_TEXT[feature];
  const value = spec.format(features[feature]);
  const effect = effectOf(delta);
  const outcome = { raises: 'higher chance', lowers: 'lower chance', neutral: 'little effect' }[effect];
  return {
    feature,
    label: spec.label,
    value,
    condition,
    effect,
    delta: Math.round(delta * 1000) / 1000,
    text: `${spec.sentence(value, features)}${condition ? ` (${condition})` : ''} → ${outcome}`,
  };
}

const byStrength = (a, b) => Math.abs(b.delta) - Math.abs(a.delta);

/**
 * Convert a prediction's decision path into reasons, strongest first.
 *
 * @param {object} prediction result of predictWithPath()
 * @param {object} features   the features that were predicted on
 * @returns {{ feature: string, label: string, value: string, condition: string|null,
 *             effect: 'raises'|'lowers'|'neutral', delta: number, text: string }[]}
 */
function explainPath(prediction, features) {
  // A feature can be split on more than once along a path — report it once
  const byFeature = new Map();
  for (const step of prediction.path) {
    const entry = byFeature.get(step.feature) || { feature: step.feature, delta: 0, conditions: [] };
    entry.delta += step.probabilityAfter - step.probabilityBefore;
    const condition = conditionText(step);
    if (condition && !entry.conditions.includes(condition)) entry.conditions.push(condition);
    byFeature.set(step.feature, entry);
  }

  return [...byFeature.values()]
    .map(({ feature, delta, conditions }) => toReason(feature, delta, conditions.length ? conditions.join(' and ') : null, features))
    .sort(byStrength);
}

// Derived inputs are explained as the raw feature they come from
const SOURCE_FEATURE = { hourSin: 'hourOfDay', hourCos: 'hourOfDay' };
// Yes/no features: the sentence already says which side the user is on
const BINARY_FEATURES = new Set(['isWeekend', 'hasHistory']);

/**
 * Per-feature effects of a logistic regression prediction, strongest first.
 * delta = p − p(with this feature's term removed), i.e. the change against an
 * otherwise identical session where this input sits at the training average.
 */
function contributionEffects(prediction) {
  const grouped = new Map();
  for (const c of prediction.contributions) {
    const feature = SOURCE_FEATURE[c.feature] || c.feature;
    const entry = grouped.get(feature) || { feature, contribution: 0, scaled: c.scaled, derived: feature !== c.feature };
    entry.contribution += c.contribution;
    grouped.set(feature, entry);
  }
  return [...grouped.values()].map((g) => ({
    ...g,
    delta: prediction.probability - sigmoid(prediction.logit - g.contribution),
    condition: g.derived || BINARY_FEATURES.has(g.feature) ? null : g.scaled >= 0 ? 'above average' : 'below average',
  }));
}

/**
 * Convert a logistic regression prediction into reasons, strongest first.
 * Same shape as explainPath().
 *
 * @param {object} prediction result of logisticRegressionModel.predict()
 * @param {object} features   the features that were predicted on
 */
function explainContributions(prediction, features) {
  return contributionEffects(prediction)
    .map(({ feature, delta, condition }) => toReason(feature, delta, condition, features))
    .sort(byStrength);
}

/**
 * Every input's effect, strongest first, in the same shape as describePath()
 * so the UI can list it the same way. There are no thresholds in a linear model.
 */
function describeContributions(prediction, features) {
  return contributionEffects(prediction)
    .sort(byStrength)
    .map(({ feature, delta, condition }, i) => {
      const spec = FEATURE_TEXT[feature];
      return {
        node: i,
        feature,
        label: spec.label,
        threshold: null,
        direction: null,
        value: features[feature],
        valueText: spec.format(features[feature]),
        condition,
        effect: effectOf(delta),
        delta: Math.round(delta * 1000) / 1000,
      };
    });
}

/**
 * Every decision on the path, in the order the tree made it (not merged or sorted).
 *
 * @returns {{ node: number, feature: string, label: string, threshold: number, direction: '<='|'>',
 *             value: number, valueText: string, condition: string|null, effect: string, delta: number }[]}
 */
function describePath(prediction, features) {
  return prediction.path.map((step) => {
    const spec = FEATURE_TEXT[step.feature];
    const delta = step.probabilityAfter - step.probabilityBefore;
    return {
      node: step.node,
      feature: step.feature,
      label: spec.label,
      threshold: step.threshold,
      direction: step.direction,
      value: step.value,
      valueText: spec.format(features[step.feature]),
      condition: conditionText(step),
      effect: effectOf(delta),
      delta: Math.round(delta * 1000) / 1000,
    };
  });
}

/** The exact values fed to the model, with readable formatting. */
function describeInputs(features) {
  return Object.entries(FEATURE_TEXT).map(([feature, spec]) => ({
    feature,
    label: spec.label,
    value: features[feature],
    valueText: spec.format(features[feature]),
  }));
}

/**
 * Try the alternatives a user actually controls and report the best one.
 *
 * Start hours are limited to hours this user has started sessions at before,
 * durations to 25/45/60 minutes. Returns null when nothing beats the current
 * plan by a meaningful margin.
 *
 * @returns {{ hourOfDay?: number, plannedDuration?: number, fromProbability: number,
 *             toProbability: number, text: string } | null}
 */
function bestCounterfactual(features, context, model) {
  const fromProbability = predict(features, model).probability;

  const hours = context.typicalHours.filter((h) => h !== features.hourOfDay).slice(0, COUNTERFACTUAL_MAX_HOURS);
  const durations = COUNTERFACTUAL_DURATIONS.filter((d) => d !== features.plannedDuration);

  // Single changes first, so a simpler suggestion wins a tie
  const options = [
    ...hours.map((hourOfDay) => ({ hourOfDay })),
    ...durations.map((plannedDuration) => ({ plannedDuration })),
    ...hours.flatMap((hourOfDay) => durations.map((plannedDuration) => ({ hourOfDay, plannedDuration }))),
  ];

  let best = null;
  for (const change of options) {
    const toProbability = predict(applyControllable(features, context, change), model).probability;
    if (toProbability - fromProbability >= MIN_COUNTERFACTUAL_GAIN && (!best || toProbability > best.toProbability)) {
      best = { ...change, toProbability };
    }
  }
  if (!best) return null;

  const parts = [];
  if (best.hourOfDay !== undefined) parts.push(`Starting at ${hourLabel(best.hourOfDay)}`);
  if (best.plannedDuration !== undefined) {
    parts.push(parts.length ? `with a ${best.plannedDuration}-min plan` : `Planning ${best.plannedDuration} min`);
  }

  return {
    ...best,
    fromProbability,
    text: `${parts.join(' ')} raises success chance from ${pct(fromProbability)} to ${pct(best.toProbability)}`,
  };
}

module.exports = {
  FEATURE_TEXT,
  COUNTERFACTUAL_DURATIONS,
  explainPath,
  explainContributions,
  describePath,
  describeContributions,
  describeInputs,
  bestCounterfactual,
  hourLabel,
};
