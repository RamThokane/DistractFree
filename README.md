# DistractFree

A focus-session app with three parts. The Chrome extension blocks distracting sites while a session runs. The React dashboard plans and reviews sessions. The Express/MongoDB API predicts, before a session starts, how likely it is to succeed. Completed sessions earn Focus Coins.

**Live:** [distractfree.site](https://distractfree.site) · API: `https://api.distractfree.site/api`

## Features

- **Focus sessions.** Start a timed session, and the extension blocks the sites you listed. Tab switches and blocked-site attempts are recorded.
- **Scheduled sessions.** Plan sessions on a calendar, one-off or repeating. They start automatically, send a reminder 10 minutes before, and are marked missed if skipped. You can also start one early with "Start now".
- **Live state.** The extension sends telemetry while a session runs, and the dashboard shows a live Focused / Drifting / Distracted badge.
- **Success prediction.** Before you start, the API estimates your chance of success, explains why, and suggests a better start time or duration.
- **Insights.** A productivity heatmap, 7-day focus and distraction scores, and the model's own accuracy report.
- **Focus Coins and leaderboard.** Completed sessions earn coins, and users are ranked against each other.
- **Google sign-in** or email and password, with JWT auth shared by the dashboard and the extension.

## Project layout

| Part | Location | Run |
|---|---|---|
| Web dashboard (React, Tailwind) | `src/` | `npm start` |
| API (Express + MongoDB) | `backend/` | `cd backend && npm run dev` |
| Chrome extension (Manifest V3, v1.2.0) | `extension/` | load unpacked in `chrome://extensions`, or use `distractfree-extension.zip` |
| Marketing site (Next.js) | `landing/` | `cd landing && npm run dev` |
| ML training (Python, scikit-learn) | `backend/ml/` | `cd backend && npm run ml:retrain` |

## Getting started

```bash
# 1. Install
npm install
npm --prefix backend install

# 2. Configure the API
cp backend/.env.example backend/.env   # then fill it in

# 3. Run
npm --prefix backend run dev   # API on http://localhost:5000
npm start                      # dashboard on http://localhost:3000
```

In development, the API falls back to an in-memory MongoDB when `MONGO_URI` is not set. The extension uses the production API by default, and you can point it at `localhost` in its popup settings.

### Environment variables (`backend/.env`)

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB connection string (required in production) |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | auth tokens |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `CLIENT_URL`, `ALLOWED_ORIGINS` | CORS (`chrome-extension://` is always allowed) |
| `ML_MODEL` | `logreg` (default) or `tree` |
| `ML_DEFAULT_TIMEZONE` | timezone for old sessions recorded without one |
| `ML_AUTO_RETRAIN` | retrain in the background after 25 new real sessions |
| `ML_ADMIN_EMAILS` | who may call `POST /api/ml/retrain` in production |

## Deployment

The dashboard and the API are deployed as separate Vercel projects.

- `distractfree.site` → the React build. `www` redirects to the apex domain.
- `api.distractfree.site` → `backend/`, a Vercel Function. `GET /api/health` reports its status.

The API has no cron job. Time-based work, such as starting due scheduled sessions and sending reminders, runs when the dashboard or extension calls in. The extension does this every minute.

## Machine learning

### Problem

Before a focus session starts, the API estimates the chance it will succeed, explains why, and suggests what the user could change. This is binary classification.

The model is trained in Python with scikit-learn, exported to JSON, and run in Node.js without Python at runtime. There are two model types:

| `ML_MODEL` | Model | Training | Inference |
|---|---|---|---|
| `logreg` (default) | `StandardScaler` → L2 `LogisticRegression` | `ml/train_model.py` | `ml/logisticRegressionModel.js` |
| `tree` | `DecisionTreeClassifier` | `ml/train_tree.py` | `ml/decisionTreeModel.js` |

`ml/activeModel.js` decides which model answers. When the logistic regression file is missing or invalid, the tree is used instead. When neither is available, the API returns the user's own past success rate.

Logistic regression is the default because, with tens of sessions, a tree overfits, its splits change with a handful of rows, and its leaf probabilities are coarse. A regularised linear model is steadier and gives one readable weight per input.

### Target

`sessionSuccess = 1` when all three hold, otherwise `0`:

- the session ended with status `completed`
- the actual duration is at least 90% of the planned duration
- there was at most one blocked-site attempt

The rule lives in one place, `backend/ml/target.js`. It is an observed outcome and is not computed from any model feature.

### Features

All features are known before the session starts. `backend/ml/featureBuilder.js` builds them for both training extraction and live inference.

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

For the logistic regression, `ml/modelInputs.js` replaces the start hour with `hourSin` and `hourCos` so that 23:00 and 00:00 are treated as neighbours. Training and inference both use this transform.

**Feature set switch.** With little data, the logistic regression uses a reduced set of 6 features: `successRateLast5`, `plannedDuration`, `currentStreak`, `hourBandSuccessRate`, `avgDistractionsLast5` and `isWeekend`. It switches to the full set once the rarer outcome has at least 10 examples per feature (130 rows).

Personalisation comes from the per-user history features. There is one global model, not one model per user.

### Why this avoids leakage

- **No label leakage.** The label is an observed outcome. The session's own duration, tab switches and distraction attempts are never features.
- **No future leakage.** History features use only the same user's sessions that started and ended before the session being predicted.
- **No train/serve drift.** Training and inference share one feature builder. After every training run, Node.js re-predicts sessions that scikit-learn already scored. If the results do not match exactly, the run fails.
- **No shuffled evaluation.** The model is tested only on sessions newer than everything it was trained on.

### Evaluation

- Only real sessions count. Simulated sessions never appear in any metric.
- **Holdout split by time.** The oldest 80% of real sessions train the model, and the newest 20% test it.
- **Walk-forward.** An expanding-window `TimeSeriesSplit` over all real sessions.
- **Grouped by user.** `LeaveOneGroupOut`, so one user is never split across train and test. This is flagged unreliable when one user holds more than half the rows.
- **Choosing `C`.** It comes from `[0.01, 0.1, 1, 10]`, picked by out-of-fold log loss inside the training part. The exported model is then refit on all real sessions with that `C`.
- **Comparisons.** The decision tree and two baselines are scored on the same splits. One baseline always predicts the majority class. The other predicts success when `successRateLast5 ≥ 0.5`.

### Current metrics

The model (`lr-20261004095429`) was trained on 4 Oct 2026 on 71 real sessions from 6 users, one of whom accounts for 62. It uses the reduced feature set with `C = 0.01`. Training covers 56 sessions (18 Apr – 27 Sep 2026), and the test covers 15 sessions (27 Sep – 2 Oct 2026).

| On the 15 test sessions | Accuracy | Balanced acc. | Precision | Recall | F1 | ROC-AUC | Log loss |
|---|---|---|---|---|---|---|---|
| Logistic regression | 40.0% | 0.45 | 0.60 | 0.30 | 0.40 | **0.62** | **0.70** |
| Decision tree | 46.7% | 0.35 | 0.58 | 0.70 | 0.64 | 0.35 | 1.06 |
| Baseline: majority class | 33.3% | 0.50 | 0.00 | 0.00 | 0.00 | 0.50 | 0.95 |
| Baseline: last-5 success rate | 60.0% | 0.55 | 0.70 | 0.70 | 0.70 | 0.46 | 0.80 |

Walk-forward accuracy over 56 predictions was 51.8% for logistic regression, 58.9% for the tree, 60.7% for the majority class and 62.5% for the last-5 baseline.

**Neither model beats the last-5 baseline on accuracy yet.** The data is small and dominated by one user, whose success rate rose from 29% in training to 67% in the test period. The logistic regression ranks sessions best (highest ROC-AUC) and has the lowest log loss, and its probabilities are better calibrated. These numbers show the model's real performance. `backend/ml/model/training_report.json` is the source of truth after each retrain.

### Explanations

Explanations come from the model itself, not from separate rules (`backend/ml/explain.js`).

- **Logistic regression.** There is one reason per input, taken from its term `coef · scaled value`. Each reason's effect is how much the probability would change if that input were at the training average.
- **Decision tree.** `predictWithPath()` returns every node visited, which is turned into reasons such as "Your success rate over the last 5 sessions is 40% (≤ 55%) → lower chance".
- **Counterfactual.** The same model is re-run with only the inputs the user controls changed. The start hour is limited to hours the user has used before, and the planned duration is set to 25, 45 or 60 minutes.

### Minimum-data guard

With fewer than 50 real sessions, no model is trained or used. The API returns `status: "learning"` and the user's own past success rate as a plain baseline.

### Learning loop

- At session start, the prediction is stored on the session (`predictedSuccessProb`, `predictedSuccess`, `modelVersion`).
- At session end, the observed outcome is stored (`actualSuccess`).
- `GET /api/insights/model` returns the training report plus live accuracy from those stored pairs.
- After 25 new real sessions, the model retrains in the background. This needs Python on the server, so it is skipped on Vercel. There, retrain locally and redeploy.

### Commands

Run these from `backend/`. Python needs `pip install -r ml/requirements.txt`.

| Command | What it does |
|---|---|
| `npm run ml:retrain` | extracts sessions → trains logistic regression → exports → validates |
| `npm run ml:retrain:tree` | the same for the decision tree |
| `npm run ml:retrain -- --include-simulated` | also trains on simulated sessions; metrics stay real-only |
| `npm run ml:seed-simulated` | writes simulated sessions to MongoDB (`-- --purge` removes them) |
| `npm test` | runs the unit tests: target, feature builder, both models, guard, scheduling |

`POST /api/ml/retrain` does the same as `ml:retrain`. In production, only the emails in `ML_ADMIN_EMAILS` can call it.

### Simulated data

`backend/ml/seedSimulatedUsers.js` simulates six personas for demos and cold start. Each persona has hidden traits, and session outcomes are drawn at random from those traits. The script writes only raw `FocusSession` documents marked `source: 'simulated'`, and the label is derived afterwards by the same target rule as real data. Simulated sessions have no `User` document, so they never appear in the leaderboard, coins or auth.

### Not machine learning

- The live "Focused / Drifting / Distracted" badge is a simple rule over the current session's counts (`backend/utils/liveFocusStatus.js`).
- The 7-day focus and distraction scores on the Insights page are descriptive composites.
