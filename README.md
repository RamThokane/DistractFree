# DistractFree

A focus-session app: a React dashboard, an Express/MongoDB API, and a Chrome extension that blocks distracting sites during a session and rewards completed sessions with Focus Coins.

| Part | Location | Run |
|---|---|---|
| Web dashboard (React) | `src/` | `npm start` |
| API (Express + MongoDB) | `backend/` | `cd backend && npm run dev` |
| Chrome extension | `extension/` | load unpacked in `chrome://extensions` |
| Marketing site (Next.js) | `landing/` | `cd landing && npm run dev` |

Copy `backend/.env.example` to `backend/.env` and fill it in before starting the API.

## Machine learning

### Problem

Before a focus session starts, estimate the chance that it will succeed, explain why, and suggest what the user could change.

It is a binary classification problem. The model is a scikit-learn `DecisionTreeClassifier`, trained in Python, exported to JSON, and run in Node.js (`backend/ml/decisionTreeModel.js`).

### Target

`sessionSuccess = 1` when all three hold, otherwise `0`:

- the session ended with status `completed`
- actual duration is at least 90% of the planned duration
- there was at most one blocked-site attempt

The rule lives in one place, `backend/ml/target.js`. It is an observed outcome. It is not computed from any model feature.

### Features

All 13 features are known before the session starts. They are built by `backend/ml/featureBuilder.js`, which both training extraction and live inference call.

| Feature | Meaning |
|---|---|
| `hourOfDay`, `dayOfWeek`, `isWeekend` | when the session starts, in the user's timezone |
| `plannedDuration` | minutes the user plans to focus |
| `successRateLast5`, `successRateLast20` | share of the user's last 5 / 20 sessions that succeeded |
| `avgDistractionsLast5`, `avgTabSwitchesLast5` | averages over the user's last 5 sessions |
| `currentStreak` | consecutive days with a completed session, as of the start |
| `minutesSinceLastSession` | capped at 1440 |
| `sessionsAlreadyToday` | sessions the user already finished today |
| `hourBandSuccessRate` | the user's past success rate in this part of the day |
| `hasHistory` | 0 for a user's first session, when the history features hold neutral defaults |

Personalisation comes from these per-user history features. There is one global tree, not one tree per user.

### Why this avoids leakage

- **No label leakage.** The label is an observed outcome. The session's own duration, tab switches and distraction attempts are never features.
- **No future leakage.** History features use only the same user's sessions that started, and ended, before the session being predicted.
- **No train/serve drift.** Training and inference share one feature builder. After every training run, Node.js re-predicts the test sessions and must match scikit-learn exactly, or the run fails.
- **No shuffled evaluation.** The model is tested only on sessions newer than everything it trained on.

### Evaluation

- Real sessions only. Simulated sessions never count in any metric.
- Time-based split: the oldest 80% of real sessions train the model, the newest 20% test it.
- Hyperparameters (`max_depth` 3–6, `min_samples_leaf` ≥ 5, `class_weight='balanced'`) are chosen with `TimeSeriesSplit` inside the training part.
- Two baselines are scored on the same test sessions: always predict the majority class, and predict success when `successRateLast5 ≥ 0.5`.
- The exported model is the one that was evaluated. It is not refit on the test sessions.
- Predicted probability is the Laplace-smoothed share of successful training sessions in the leaf. The predicted class comes from the class-weighted tree, so it can be "successful" below 50%.

### Current metrics

Trained 2026-10-02 on 71 real sessions from 6 users, one of whom accounts for 62. Train: 56 sessions (18 Apr – 27 Sep 2026). Test: 15 sessions (27 Sep – 2 Oct 2026).

| On the 15 test sessions | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Decision tree | 46.7% | 0.58 | 0.70 | 0.64 | 0.35 |
| Baseline: majority class | 33.3% | 0.00 | 0.00 | 0.00 | 0.50 |
| Baseline: last-5 success rate | 60.0% | 0.70 | 0.70 | 0.70 | 0.46 |

Confusion matrix for the tree (rows actual, columns predicted; not successful, successful): `[[0, 5], [3, 7]]`.

Walk-forward check over 56 predictions (4 expanding folds): tree 58.9%, majority class 60.7%, last-5 baseline 62.5%.

**The tree does not yet beat the last-5 baseline.** The data is small and dominated by one user, whose success rate rose from 29% in the training period to 67% in the test period. Some of the tree's splits are noise at this size, and its explanations show that plainly. The numbers above are the honest state, and `backend/ml/model/training_report.json` is the source of truth after each retrain.

### Explanations

Explanations come from the tree, not from separate rules.

- `predictWithPath(features)` returns the probability, the predicted class, and every node visited: feature, threshold, direction, and the user's value.
- `backend/ml/explain.js` turns that path into reasons such as "Your success rate over the last 5 sessions is 40% (≤ 55%) → lower chance". Each reason's effect is the change in success rate at that split.
- The counterfactual re-runs the tree with only controllable features changed: the start hour (limited to hours the user has used before) and the planned duration (25, 45 or 60 minutes).

### Minimum-data guard

With fewer than 50 real sessions no model is trained or used. The API returns `status: "learning"` and the user's own past success rate as a plain baseline.

### Learning loop

- At session start the prediction is stored on the session (`predictedSuccessProb`, `predictedSuccess`, `modelVersion`).
- At session end the observed outcome is stored (`actualSuccess`).
- `GET /api/insights/model` returns the training report plus live accuracy from those stored pairs.
- After 25 new real sessions the model retrains in the background. This needs Python on the server, so it is skipped on Vercel; retrain locally and redeploy there.

### Commands

Run from `backend/`. Python needs `pip install -r ml/requirements.txt`.

| Command | What it does |
|---|---|
| `npm run ml:retrain` | extract sessions → train → export → validate |
| `npm run ml:retrain -- --include-simulated` | also train on simulated sessions; metrics stay real-only |
| `npm run ml:seed-simulated` | write simulated sessions to MongoDB (`-- --purge` removes them) |
| `npm test` | unit tests: target, feature builder, tree path, guard |

`POST /api/ml/retrain` does the same as `ml:retrain`. In production it is limited to the emails in `ML_ADMIN_EMAILS`.

### Simulated data

`backend/ml/seedSimulatedUsers.js` simulates six personas for demos and cold start. Each persona has hidden traits, and session outcomes are drawn at random from those traits. The script writes only raw `FocusSession` documents marked `source: 'simulated'`; the label is derived afterwards by the same target rule as real data. Simulated sessions have no `User` document, so they never appear in the leaderboard, coins or auth.

### Not machine learning

- The live "Focused / Drifting / Distracted" badge during a session is a simple rule over that session's counts (`backend/utils/liveFocusStatus.js`).
- The 7-day focus and distraction scores on the Insights page are descriptive composites.
