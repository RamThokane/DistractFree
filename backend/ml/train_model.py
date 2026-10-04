"""
DistractFree - Logistic Regression Training Pipeline
=====================================================

Task:   before a focus session starts, predict whether it will succeed.
Target: sessionSuccess (0/1), an observed outcome defined in ml/target.js.
Input:  ml/data/training_data.csv, written by extractTrainingData.js. Every
        feature column is known before the session starts. The derived
        columns (hourSin, hourCos) are computed in Node (ml/modelInputs.js)
        and used here as-is, so training and inference share one transform.

Why logistic regression: with tens of sessions a tree overfits, its splits
change with a handful of rows, and its leaf probabilities are coarse. An
L2-regularised linear model is steadier and gives one readable weight per
input.

Model: StandardScaler -> LogisticRegression(L2, class_weight='balanced'), as
one Pipeline so the scaler is only ever fit on training rows.

How the model is evaluated (real sessions only):
  - Time-based holdout: train on the oldest 80%, test on the newest 20%.
    These are the headline `metrics`, comparable with earlier reports.
  - Walk-forward: expanding-window TimeSeriesSplit over all real sessions.
  - Grouped by user: LeaveOneGroupOut (few users) or GroupKFold. Rows of one
    user share history features, so a user is never split across train and
    test. With one dominant user this split is unreliable and is flagged.
  - The decision tree (train_tree.py) and two baselines are scored on the
    same splits.

C is chosen from C_GRID by pooled out-of-fold log loss inside the training
part of the holdout. The exported model is then refit on every real session
with that C.

Usage:
    python ml/train_model.py [--include-simulated] [--min-real 50] [--feature-set auto|reduced|full]

Outputs:
    ml/model/logistic_regression_model.json   parameters for Node.js inference
    ml/model/training_report.json             metrics, baselines, coefficients
"""

import argparse
import json
import sys
import warnings
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss
from sklearn.model_selection import GridSearchCV, GroupKFold, LeaveOneGroupOut, TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

import train_tree
from train_tree import (
    CLASS_NAMES,
    DATA_DIR,
    MODEL_DIR,
    TARGET,
    TEST_FRACTION,
    cv_splits,
    date_range,
)

MODEL_PATH = MODEL_DIR / "logistic_regression_model.json"
REPORT_PATH = MODEL_DIR / "training_report.json"

# -- Features ------------------------------------------
# hourOfDay is replaced by hourSin/hourCos; dayOfWeek is dropped (isWeekend kept)
FULL_FEATURES = [
    "isWeekend",
    "plannedDuration",
    "successRateLast5",
    "successRateLast20",
    "avgDistractionsLast5",
    "avgTabSwitchesLast5",
    "currentStreak",
    "minutesSinceLastSession",
    "sessionsAlreadyToday",
    "hourBandSuccessRate",
    "hasHistory",
    "hourSin",
    "hourCos",
]
REDUCED_FEATURES = [
    "successRateLast5",
    "plannedDuration",
    "currentStreak",
    "hourBandSuccessRate",
    "avgDistractionsLast5",
    "isWeekend",
]

# The feature-set switch. "auto" uses REDUCED_FEATURES while the rarer outcome
# has fewer than MIN_EVENTS_PER_FEATURE examples per FULL_FEATURES column,
# and FULL_FEATURES after that. "reduced" / "full" force one set.
FEATURE_SET = "auto"
MIN_EVENTS_PER_FEATURE = 10

C_GRID = [0.01, 0.1, 1, 10]
PARITY_SAMPLES = 25

# Grouped CV is flagged unreliable when one user holds more than this share of rows
MAX_GROUP_SHARE = 0.5
MIN_GROUPS = 3


def new_model(C):
    return Pipeline([
        ("scale", StandardScaler()),
        ("lr", LogisticRegression(penalty="l2", C=C, class_weight="balanced", solver="lbfgs", max_iter=1000)),
    ])


def choose_features(real, mode):
    """Return (features, rule) for the requested feature-set mode."""
    counts = real[TARGET].value_counts()
    minority = int(counts.min()) if len(counts) == 2 else 0
    needed = MIN_EVENTS_PER_FEATURE * len(FULL_FEATURES)
    if mode == "auto":
        mode = "full" if minority >= needed else "reduced"
    rule = {
        "switch": FEATURE_SET,
        "used": mode,
        "minority_class_rows": minority,
        "needed_for_full": needed,
        "min_events_per_feature": MIN_EVENTS_PER_FEATURE,
    }
    return (FULL_FEATURES if mode == "full" else REDUCED_FEATURES), rule


def score(y_true, y_pred, y_prob):
    """Classification metrics (shared with the tree) plus probability quality."""
    y_true = np.asarray(y_true)
    y_prob = np.clip(np.asarray(y_prob, dtype=float), 1e-15, 1 - 1e-15)
    out = train_tree.score(y_true, y_pred, y_prob)
    out["log_loss"] = round(float(log_loss(y_true, y_prob, labels=[0, 1])), 4)
    out["brier"] = round(float(brier_score_loss(y_true, y_prob, pos_label=1)), 4)
    out["class_counts"] = {CLASS_NAMES[0]: int((y_true == 0).sum()), CLASS_NAMES[1]: int((y_true == 1).sum())}
    return out


def grouping_quality(frame):
    sizes = frame["userKey"].value_counts()
    share = float(sizes.iloc[0] / len(frame)) if len(frame) else 1.0
    return {
        "n_groups": int(len(sizes)),
        "largest_group_share": round(share, 4),
        "reliable": bool(len(sizes) >= MIN_GROUPS and share <= MAX_GROUP_SHARE),
    }


def group_splitter(frame):
    n_groups = frame["userKey"].nunique()
    if n_groups <= 5:
        return LeaveOneGroupOut(), "LeaveOneGroupOut"
    return GroupKFold(n_splits=5), "GroupKFold(5)"


def fold_indices(frame, kind):
    """(train_idx, test_idx) pairs over `frame` (sorted oldest first)."""
    if kind == "time":
        return list(TimeSeriesSplit(n_splits=cv_splits(len(frame))).split(frame))
    splitter, _ = group_splitter(frame)
    return list(splitter.split(frame, groups=frame["userKey"]))


def tune_C(frame, features, kind):
    """Pick C by pooled out-of-fold log loss. Returns (best_C, {C: metrics})."""
    folds = [(tr, te) for tr, te in fold_indices(frame, kind) if frame.iloc[tr][TARGET].nunique() == 2]
    by_C = {}
    for C in C_GRID:
        truth, prob = [], []
        for tr, te in folds:
            model = new_model(C).fit(frame.iloc[tr][features], frame.iloc[tr][TARGET])
            prob.extend(model.predict_proba(frame.iloc[te][features])[:, 1])
            truth.extend(frame.iloc[te][TARGET])
        if not truth:
            continue
        pred = (np.asarray(prob) > 0.5).astype(int)
        m = score(truth, pred, prob)
        by_C[str(C)] = {"log_loss": m["log_loss"], "balanced_accuracy": m["balanced_accuracy"], "roc_auc": m["roc_auc"]}
    if not by_C:
        return 1.0, {}
    best = min(by_C, key=lambda c: (by_C[c]["log_loss"], -float(c)))  # tie -> stronger regularisation
    return float(best), by_C


def tune_tree(frame, tree_features, kind):
    """Best tree params on the same kind of folds, scored like train_tree.py does."""
    folds = [(tr, te) for tr, te in fold_indices(frame, kind) if frame.iloc[tr][TARGET].nunique() == 2]
    grid = GridSearchCV(train_tree.new_tree(), train_tree.PARAM_GRID, cv=folds,
                        scoring=train_tree.CV_SCORING, n_jobs=1, error_score=np.nan)
    grid.fit(frame[tree_features], frame[TARGET])
    return grid.best_params_


def tree_probabilities(train, test, tree_features, params):
    """Deployed tree probabilities: Laplace-smoothed leaf success rate (train_tree.py)."""
    tree = train_tree.new_tree(**params).fit(train[tree_features], train[TARGET])
    counts = train_tree.node_counts(tree, train[tree_features], train[TARGET])
    prob = train_tree.success_probability(counts)[tree.apply(test[tree_features])]
    return tree.predict(test[tree_features]), prob


def predict_all(train, test, features, C, tree_features, tree_params):
    """Every scored predictor on one train/test split: {name: (pred, prob)}."""
    model = new_model(C).fit(train[features], train[TARGET])
    real_train = train[train["source"] == "real"]
    base_rate = float(real_train[TARGET].mean()) if len(real_train) else float(train[TARGET].mean())
    return {
        "model": (model.predict(test[features]), model.predict_proba(test[features])[:, 1]),
        "decision_tree": tree_probabilities(train, test, tree_features, tree_params),
        "majority_class": (np.full(len(test), int(base_rate >= 0.5)), np.full(len(test), base_rate)),
        "last5_success_rate": (
            (test["successRateLast5"] >= 0.5).astype(int).to_numpy(),
            test["successRateLast5"].to_numpy(),
        ),
    }


def pooled_cv(real, simulated, features, C, tree_features, tree_params, kind):
    """Pool out-of-fold predictions of every predictor over one CV scheme."""
    pooled, truth = {}, []
    folds = fold_indices(real, kind)
    for train_idx, test_idx in folds:
        train = pd.concat([real.iloc[train_idx], simulated]).sort_values("startTime")
        test = real.iloc[test_idx]
        if train[TARGET].nunique() < 2:
            continue
        for name, (pred, prob) in predict_all(train, test, features, C, tree_features, tree_params).items():
            pooled.setdefault(name, ([], []))
            pooled[name][0].extend(pred)
            pooled[name][1].extend(prob)
        truth.extend(test[TARGET])
    if not truth:
        return None
    scores = {name: score(truth, pred, prob) for name, (pred, prob) in pooled.items()}
    # A constant guess has no ranking ability; pooled folds would fake an AUC
    scores["majority_class"]["roc_auc"] = None
    return {"n_splits": len(folds), "n_predictions": len(truth), **scores}


def write_report(report):
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"      Report saved to {REPORT_PATH}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--include-simulated", action="store_true",
                        help="also train on simulated sessions (metrics stay real-only)")
    parser.add_argument("--min-real", type=int, default=50,
                        help="minimum real sessions required to train a model")
    parser.add_argument("--feature-set", choices=["auto", "reduced", "full"], default=FEATURE_SET,
                        help="override FEATURE_SET for this run")
    args = parser.parse_args()
    warnings.filterwarnings("ignore")

    print("=" * 60)
    print("DistractFree - Logistic Regression Training Pipeline")
    print("=" * 60)

    # -- 1. Load data ----------------------------------
    csv_path = DATA_DIR / "training_data.csv"
    if not csv_path.exists():
        print(f"\n[ERROR] {csv_path} not found.")
        print("        Run `node ml/extractTrainingData.js` first to build it from MongoDB.")
        sys.exit(1)

    print(f"\n[1/5] Loading dataset from {csv_path}")
    df = pd.read_csv(csv_path)
    missing = [c for c in FULL_FEATURES if c not in df.columns]
    if missing:
        print(f"\n[ERROR] Training CSV is missing columns {missing}.")
        print("        Re-run `node ml/extractTrainingData.js` to rebuild it.")
        sys.exit(1)
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df = df.sort_values("startTime").reset_index(drop=True)
    # Columns the tree comparison is trained on: the raw feature set, as in train_tree.py
    tree_features = [c for c in df.columns if c not in train_tree.META_COLUMNS + train_tree.DERIVED_COLUMNS + [TARGET]]
    input_columns = [c for c in df.columns if c not in train_tree.META_COLUMNS + [TARGET]]

    real = df[df["source"] == "real"].reset_index(drop=True)
    simulated = df[df["source"] == "simulated"] if args.include_simulated else df.iloc[0:0]
    trained_at = datetime.now(timezone.utc)
    print(f"      Real sessions: {len(real)}, simulated sessions used: {len(simulated)}")

    # -- Minimum-data guard ----------------------------
    if len(real) < args.min_real:
        print(f"\n[STOP] Only {len(real)} real sessions (< {args.min_real}). No model was trained.")
        write_report({
            "status": "insufficient_data",
            "model_kind": "logistic_regression",
            "trained_at": trained_at.isoformat(),
            "n_real": len(real),
            "n_simulated": len(simulated),
            "min_real_sessions": args.min_real,
        })
        return

    if real[TARGET].nunique() < 2:
        print("\n[ERROR] Real sessions contain only one outcome; a classifier cannot be trained.")
        sys.exit(1)

    features, feature_rule = choose_features(real, args.feature_set)
    print(f"      Feature set: {feature_rule['used']} ({len(features)} features; "
          f"rarer outcome has {feature_rule['minority_class_rows']} rows, full set needs {feature_rule['needed_for_full']})")

    # -- 2. Time-based split ---------------------------
    split = int(len(real) * (1 - TEST_FRACTION))
    test = real.iloc[split:]
    train_real = real.iloc[:split]
    train = pd.concat([train_real, simulated]).sort_values("startTime").reset_index(drop=True)
    print(f"\n[2/5] Time-based split: train {len(train)} (oldest) / test {len(test)} (newest, real only)")
    if train[TARGET].nunique() < 2:
        print("\n[ERROR] The training period contains only one outcome; a classifier cannot be trained.")
        sys.exit(1)

    # -- 3. Choose C -----------------------------------
    grouping = grouping_quality(train_real)
    tune_kind = "group" if grouping["reliable"] else "time"
    tune_splitter = group_splitter(train_real)[1] if tune_kind == "group" else "TimeSeriesSplit"
    print(f"\n[3/5] Choosing C from {C_GRID} by out-of-fold log loss ({tune_splitter})")
    if tune_kind == "time":
        print(f"      Grouped-by-user CV is unreliable here ({grouping['n_groups']} users, largest holds "
              f"{grouping['largest_group_share']:.0%} of rows), so C is tuned on time-ordered folds")
    tune_frame = train_real.reset_index(drop=True)
    best_C, scores_by_C = tune_C(tune_frame, features, tune_kind)
    tree_params = tune_tree(tune_frame, tree_features, tune_kind)
    print(f"      Best C: {best_C}  ({scores_by_C.get(str(best_C))})")
    print(f"      Tree params for comparison: {tree_params}")

    # -- 4. Evaluate -----------------------------------
    print("\n[4/5] Scoring on held-out newest sessions, walk-forward and grouped-by-user CV")
    holdout = {name: score(test[TARGET], pred, prob)
               for name, (pred, prob) in predict_all(train, test, features, best_C, tree_features, tree_params).items()}
    forward = pooled_cv(real, simulated, features, best_C, tree_features, tree_params, "time")
    grouped = pooled_cv(real, simulated, features, best_C, tree_features, tree_params, "group")
    grouped_info = {"splitter": group_splitter(real)[1], **grouping_quality(real)}

    for name, m in holdout.items():
        print(f"      holdout {name:<20} acc={m['accuracy']:.3f}  auc={m['roc_auc']}  logloss={m['log_loss']:.3f}  brier={m['brier']:.3f}")
    if grouped:
        for name in ("model", "decision_tree"):
            m = grouped[name]
            print(f"      grouped {name:<20} auc={m['roc_auc']}  logloss={m['log_loss']:.3f}  bal_acc={m['balanced_accuracy']}")

    # -- 5. Refit on everything and export -------------
    print("\n[5/5] Refitting on all real sessions and exporting")
    final_frame = pd.concat([real, simulated]).sort_values("startTime").reset_index(drop=True)
    final = new_model(best_C).fit(final_frame[features], final_frame[TARGET])
    scaler, lr = final.named_steps["scale"], final.named_steps["lr"]
    coefficients = [float(c) for c in lr.coef_[0]]
    model_version = f"lr-{trained_at.strftime('%Y%m%d%H%M%S')}"

    counts = real[TARGET].value_counts()
    class_balance = {CLASS_NAMES[0]: int(counts.get(0, 0)), CLASS_NAMES[1]: int(counts.get(1, 0))}
    abs_sum = sum(abs(c) for c in coefficients) or 1.0
    importances = sorted(
        ({"feature": f, "importance": round(abs(c) / abs_sum, 4), "coefficient": round(c, 4)}
         for f, c in zip(features, coefficients)),
        key=lambda x: -x["importance"],
    )

    # Known inputs and outputs, re-checked by Node after every training run.
    # `inputs` holds every CSV input column so Node runs its full transform.
    sample_rows = real.iloc[np.linspace(0, len(real) - 1, min(PARITY_SAMPLES, len(real))).astype(int)]
    sample_prob = final.predict_proba(sample_rows[features])[:, 1]
    sample_pred = final.predict(sample_rows[features])
    parity = [
        {"inputs": [float(v) for v in sample_rows[input_columns].iloc[i]],
         "probability": float(sample_prob[i]),
         "predictedClass": int(sample_pred[i])}
        for i in range(len(sample_rows))
    ]

    model_metrics = holdout.pop("model")
    tree_holdout = holdout.pop("decision_tree")
    export = {
        "kind": "logistic_regression",
        "version": model_version,
        "trainedAt": trained_at.isoformat(),
        "featureNames": features,
        "means": [float(x) for x in scaler.mean_],
        "stds": [float(x) for x in scaler.scale_],
        "coefficients": coefficients,
        "intercept": float(lr.intercept_[0]),
        "C": best_C,
        "classNames": CLASS_NAMES,
        "metrics": {
            "holdout": model_metrics,
            "walk_forward": forward["model"] if forward else None,
            "grouped_cv": grouped["model"] if grouped else None,
        },
        "nSamples": len(final_frame),
        "nReal": len(real),
        "nSimulated": len(simulated),
        "classBalance": class_balance,
        "featureSet": feature_rule,
        "inputColumns": input_columns,
        "paritySamples": parity,
    }
    with open(MODEL_PATH, "w") as f:
        json.dump(export, f, indent=2)
    print(f"[ML] Logistic regression exported to {MODEL_PATH} ({len(features)} features, C={best_C})")

    tuned = scores_by_C.get(str(best_C), {})
    write_report({
        "status": "trained",
        "model_kind": "logistic_regression",
        "model_version": model_version,
        "trained_at": trained_at.isoformat(),
        "n_real": len(real),
        "n_simulated": len(simulated),
        "n_train": len(train),
        "task": "Pre-session prediction of sessionSuccess (binary)",
        "target": "status == 'completed' AND duration >= 0.9 * plannedDuration AND distractionAttempts <= 1",
        "evaluated_on": "real sessions only",
        "split": "time-based: oldest 80% of real sessions train, newest 20% test",
        "final_fit": "refit on all real sessions with the chosen C",
        "n_train_real": split,
        "n_test": len(test),
        "train_range": date_range(train_real),
        "test_range": date_range(test),
        "success_rate": {
            "train_real": round(float(train_real[TARGET].mean()), 4),
            "test": round(float(test[TARGET].mean()), 4),
        },
        "class_names": CLASS_NAMES,
        "class_balance": class_balance,
        "metrics": model_metrics,
        "baselines": holdout,
        "beats_baseline": {name: bool(model_metrics["accuracy"] > m["accuracy"]) for name, m in holdout.items()},
        "walk_forward": forward,
        "grouped_cv": {**grouped_info, **(grouped or {})},
        "model_comparison": {
            "decision_tree": {
                "params": tree_params,
                "holdout": tree_holdout,
                "walk_forward": forward["decision_tree"] if forward else None,
                "grouped_cv": grouped["decision_tree"] if grouped else None,
            },
        },
        "best_params": {"C": best_C, "feature_set": feature_rule["used"]},
        "cv": {
            "splitter": tune_splitter,
            "n_splits": len(fold_indices(tune_frame, tune_kind)),
            "scoring": "balanced_accuracy",
            "selected_by": "log_loss",
            "best_score": tuned.get("balanced_accuracy"),
            "best_log_loss": tuned.get("log_loss"),
            "scores_by_C": scores_by_C,
        },
        "feature_set": feature_rule,
        "feature_names": features,
        "intercept": round(float(lr.intercept_[0]), 4),
        "coefficients": [{"feature": f, "coefficient": round(c, 4)} for f, c in zip(features, coefficients)],
        "feature_importances": importances,
        "min_real_sessions": args.min_real,
    })

    print("\n[DONE] Training complete")


if __name__ == "__main__":
    main()
