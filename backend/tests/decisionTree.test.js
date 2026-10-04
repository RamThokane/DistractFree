const test = require('node:test');
const assert = require('node:assert/strict');
const { predictWithPath, isCompatible } = require('../ml/decisionTreeModel');
const { explainPath, bestCounterfactual } = require('../ml/explain');
const { tinyTree, features } = require('./helpers');

const tree = tinyTree();
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} !== ${b}`);

test('traversal follows <= to the left child and > to the right', () => {
  const left = predictWithPath(features({ successRateLast5: 0.4, hourOfDay: 10 }), tree);
  assert.equal(left.leaf.node, 3);
  const right = predictWithPath(features({ successRateLast5: 0.4, hourOfDay: 22 }), tree);
  assert.equal(right.leaf.node, 4);
  const shallow = predictWithPath(features({ successRateLast5: 0.8 }), tree);
  assert.equal(shallow.leaf.node, 2);
});

test('a value equal to the threshold goes left, as in scikit-learn', () => {
  assert.equal(predictWithPath(features({ successRateLast5: 0.55, hourOfDay: 10 }), tree).leaf.node, 3);
});

test('the path lists every node visited with feature, threshold, direction and the actual value', () => {
  const result = predictWithPath(features({ successRateLast5: 0.4, hourOfDay: 22 }), tree);
  assert.deepEqual(
    result.path.map(({ node, feature, threshold, direction, value }) => ({ node, feature, threshold, direction, value })),
    [
      { node: 0, feature: 'successRateLast5', threshold: 0.55, direction: '<=', value: 0.4 },
      { node: 1, feature: 'hourOfDay', threshold: 20.5, direction: '>', value: 22 },
    ]
  );
  assert.equal(result.path[0].samples, 13);
  assert.equal(result.path[1].samples, 6);
});

test('probability is the smoothed share of successes in the leaf; class comes from the tree', () => {
  const good = predictWithPath(features({ successRateLast5: 0.8 }), tree);
  close(good.probability, (5 + 1) / (7 + 2));
  assert.equal(good.predictedClass, 1);
  assert.equal(good.label, 'successful');
  assert.equal(good.leaf.samples, 7);

  const bad = predictWithPath(features({ successRateLast5: 0.4, hourOfDay: 22 }), tree);
  close(bad.probability, 1 / 8); // 0 of 6, smoothed — never exactly 0
  assert.equal(bad.predictedClass, 0);
  close(bad.baseRate, 9 / 22);
});

test('the steps of a path add up from the base rate to the final probability', () => {
  const result = predictWithPath(features({ successRateLast5: 0.4, hourOfDay: 22 }), tree);
  const total = result.path.reduce((sum, s) => sum + (s.probabilityAfter - s.probabilityBefore), result.baseRate);
  close(total, result.probability);
});

test('predicting without a model is an error, not a silent guess', () => {
  assert.throws(() => predictWithPath(features(), null), /No trained model/);
});

test('a model trained on different features is rejected', () => {
  assert.equal(isCompatible(tree), true);
  assert.equal(isCompatible(tinyTree({ feature_names: ['timeOfDay', 'websiteCategory', 'sessionDuration', 'previousDistractions', 'focusScore'] })), false);
  assert.equal(isCompatible(null), false);
});

// ── Explanations ───────────────────────────────────

test('reasons come from the path and say which way each split pushed', () => {
  const f = features({ successRateLast5: 0.4, hourOfDay: 22 });
  const reasons = explainPath(predictWithPath(f, tree), f);

  assert.deepEqual(reasons.map((r) => r.feature).sort(), ['hourOfDay', 'successRateLast5']);
  const byFeature = Object.fromEntries(reasons.map((r) => [r.feature, r]));

  assert.equal(byFeature.successRateLast5.text, 'Your success rate over the last 5 sessions is 40% (≤ 55%) → lower chance');
  assert.equal(byFeature.successRateLast5.effect, 'lowers');
  assert.equal(byFeature.hourOfDay.text, "You're starting at 10 PM (9 PM or later) → lower chance");

  const morning = features({ successRateLast5: 0.4, hourOfDay: 10 });
  const hourReason = explainPath(predictWithPath(morning, tree), morning).find((r) => r.feature === 'hourOfDay');
  assert.equal(hourReason.text, "You're starting at 10 AM (before 9 PM) → higher chance");

  // Strongest effect first
  assert.ok(Math.abs(reasons[0].delta) >= Math.abs(reasons[1].delta));
});

test('a split that helped is reported as raising the chance', () => {
  const f = features({ successRateLast5: 0.8 });
  const [reason] = explainPath(predictWithPath(f, tree), f);
  assert.equal(reason.effect, 'raises');
  assert.equal(reason.text, 'Your success rate over the last 5 sessions is 80% (> 55%) → higher chance');
});

test('only features on the path are ever given as reasons', () => {
  const f = features({ successRateLast5: 0.8, avgTabSwitchesLast5: 99, avgDistractionsLast5: 99 });
  const reasons = explainPath(predictWithPath(f, tree), f);
  assert.deepEqual(reasons.map((r) => r.feature), ['successRateLast5']);
});

// ── Counterfactual ─────────────────────────────────

const context = { bandRates: { morning: 0.6, late: 0.1 }, overallRate: 0.4, typicalHours: [22, 9, 14] };

test('the counterfactual changes only controllable features and reports the best option', () => {
  const f = features({ successRateLast5: 0.4, hourOfDay: 22 });
  const result = bestCounterfactual(f, context, tree);

  assert.equal(result.hourOfDay, 9); // 22 is the current hour, 9 is the next most typical
  assert.equal(result.plannedDuration, undefined); // duration is not in this tree, so it cannot help
  close(result.fromProbability, 1 / 8);
  close(result.toProbability, 4 / 9);
  assert.equal(result.text, 'Starting at 9 AM raises success chance from 13% to 44%');
});

test('no counterfactual is offered when nothing controllable helps', () => {
  // Already in the best leaf this tree has for an hour/duration change
  assert.equal(bestCounterfactual(features({ successRateLast5: 0.8 }), context, tree), null);
  // No other typical hours to suggest
  const f = features({ successRateLast5: 0.4, hourOfDay: 22 });
  assert.equal(bestCounterfactual(f, { ...context, typicalHours: [22] }, tree), null);
});

test('a duration change is suggested when the tree splits on planned duration', () => {
  const durationTree = tinyTree({
    feature: [tree.feature[0], tree.feature_names.indexOf('plannedDuration'), -2, -2, -2],
    threshold: [0.55, 30, -2, -2, -2],
    value: [[12, 8], [10, 3], [2, 5], [4, 3], [6, 0]],
  });
  const f = features({ successRateLast5: 0.4, plannedDuration: 60 });
  const result = bestCounterfactual(f, { ...context, typicalHours: [] }, durationTree);
  assert.equal(result.plannedDuration, 25);
  assert.equal(result.hourOfDay, undefined);
  assert.equal(result.text, 'Planning 25 min raises success chance from 13% to 44%');
});

// ── Path steps, inputs and importances for display ─

const { describePath, describeInputs } = require('../ml/explain');
const { computeFeatureImportances, getModelInfo } = require('../ml/decisionTreeModel');
const { FEATURE_NAMES } = require('../ml/featureBuilder');

test('describePath keeps every step in tree order with threshold, direction and value', () => {
  const f = features({ successRateLast5: 0.4, hourOfDay: 22 });
  const steps = describePath(predictWithPath(f, tree), f);
  assert.deepEqual(
    steps.map(({ feature, threshold, direction, value, condition, effect }) => ({ feature, threshold, direction, value, condition, effect })),
    [
      { feature: 'successRateLast5', threshold: 0.55, direction: '<=', value: 0.4, condition: '≤ 55%', effect: 'lowers' },
      { feature: 'hourOfDay', threshold: 20.5, direction: '>', value: 22, condition: '9 PM or later', effect: 'lowers' },
    ]
  );
  assert.equal(steps[0].valueText, '40%');
});

test('describeInputs lists every model input exactly once', () => {
  const inputs = describeInputs(features());
  assert.deepEqual(inputs.map((i) => i.feature).sort(), [...FEATURE_NAMES].sort());
  assert.equal(inputs.find((i) => i.feature === 'plannedDuration').valueText, '25 min');
});

test('feature importances from the tree JSON cover only split features and sum to 1', () => {
  const importances = computeFeatureImportances(tree);
  const used = importances.filter((i) => i.importance > 0).map((i) => i.feature).sort();
  assert.deepEqual(used, ['hourOfDay', 'successRateLast5']);
  assert.ok(Math.abs(importances.reduce((s, i) => s + i.importance, 0) - 1) < 1e-3);
  assert.deepEqual(computeFeatureImportances(null), []);
});

test('model info reports version and size', () => {
  assert.deepEqual(getModelInfo(tree), { version: 'dt-test', trainedAt: '2026-01-01T00:00:00+00:00', nodes: 5, depth: undefined });
  assert.equal(getModelInfo(null), null);
});
