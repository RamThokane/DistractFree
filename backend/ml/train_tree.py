"""
DistractFree - Decision Tree Training Pipeline
===============================================

Task:   before a focus session starts, predict whether it will succeed.
Target: sessionSuccess (0/1), an observed outcome defined in ml/target.js.
Input:  ml/data/training_data.csv, written by extractTrainingData.js. Every
        feature column is known before the session starts. The derived
        columns for the logistic regression (hourSin, hourCos) are ignored:
        a tree splits on hourOfDay directly.

This is the decision-tree pipeline, kept as a fallback (ML_MODEL=tree).
The default model is logistic regression (train_model.py).

How the model is evaluated:
  - Time-based split: train on the oldest 80% of REAL sessions, test on the
    newest 20%. No shuffling, so the model is always tested on sessions that
    happened after everything it learned from.
  - Hyperparameters are chosen with TimeSeriesSplit inside the training part.
  - Reported metrics are on real sessions only. Simulated sessions
    (--include-simulated) can be added to the training part, never to the test.
  - Two baselines are scored on the same test sessions.

Usage:
    python ml/train_tree.py [--include-simulated] [--min-real 50]

Outputs:
    ml/model/decision_tree_model.json      tree for Node.js inference
    ml/model/decision_tree_model.pkl       Python pickle for re-use
    ml/model/tree_training_report.json     metrics, baselines, importances
"""

import argparse
import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, TimeSeriesSplit
from sklearn.tree import DecisionTreeClassifier

# -- Paths ---------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
DATA_DIR = BASE_DIR / "data"
MODEL_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

# -- Columns -------------------------------------------
TARGET = "sessionSuccess"
META_COLUMNS = ["userKey", "startTime", "source"]
# Written for the logistic regression (ml/modelInputs.js); the tree must keep
# exactly the columns of FEATURE_NAMES in featureBuilder.js
DERIVED_COLUMNS = ["hourSin", "hourCos"]
REPORT_PATH = MODEL_DIR / "tree_training_report.json"
CLASS_NAMES = ["not_successful", "successful"]

TEST_FRACTION = 0.2
RANDOM_STATE = 42

# Shallow trees with reasonably sized leaves stay readable and explainable
PARAM_GRID = {
    "max_depth": [3, 4, 5, 6],
    "min_samples_leaf": [5, 8, 12],
    "criterion": ["gini", "entropy"],
}
CV_SCORING = "balanced_accuracy"


def new_tree(**params):
    return DecisionTreeClassifier(class_weight="balanced", random_state=RANDOM_STATE, **params)


def cv_splits(n_rows):
    """Number of TimeSeriesSplit folds a training set of this size can support."""
    return int(max(2, min(5, n_rows // 15)))


def node_counts(tree, X, y):
    """Raw (unweighted) [failures, successes] training counts for every node."""
    reached = tree.decision_path(X)  # samples x nodes
    y = np.asarray(y)
    fail = np.asarray(reached.T @ (y == 0).astype(float)).ravel()
    success = np.asarray(reached.T @ (y == 1).astype(float)).ravel()
    return np.stack([fail, success], axis=1).astype(int)


def success_probability(counts):
    """Laplace-smoothed share of successes; mirrors successRate() in decisionTreeModel.js."""
    return (counts[:, 1] + 1) / (counts.sum(axis=1) + 2)


def score(y_true, y_pred, y_prob):
    """All reported metrics for one set of predictions. Positive class = successful."""
    y_true = np.asarray(y_true)
    both_classes = len(np.unique(y_true)) == 2
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "balanced_accuracy": round(float(balanced_accuracy_score(y_true, y_pred)), 4) if both_classes else None,
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        # ROC-AUC needs both outcomes in the test set and a non-constant score
        "roc_auc": round(float(roc_auc_score(y_true, y_prob)), 4) if both_classes else None,
        # rows = actual, columns = predicted, order = CLASS_NAMES
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist(),
    }


def predict_all(train, test, features, params):
    """Fit on `train`, return (model predictions, majority baseline, last-5 baseline) for `test`."""
    model = new_tree(**params).fit(train[features], train[TARGET])
    counts = node_counts(model, train[features], train[TARGET])
    model_prob = success_probability(counts)[model.apply(test[features])]

    real_train = train[train["source"] == "real"]
    base_rate = float(real_train[TARGET].mean())
    majority = int(base_rate >= 0.5)

    return {
        "model": (model.predict(test[features]), model_prob),
        "majority_class": (np.full(len(test), majority), np.full(len(test), base_rate)),
        "last5_success_rate": (
            (test["successRateLast5"] >= 0.5).astype(int).to_numpy(),
            test["successRateLast5"].to_numpy(),
        ),
    }


def walk_forward(real, simulated, features, params):
    """
    Expanding-window evaluation over all real sessions: each fold trains on the
    past and predicts the next block. Pools more test sessions than the single
    80/20 split, so it is a steadier (still small-sample) estimate.
    """
    pooled = {}
    truth = []
    n_splits = cv_splits(len(real))
    for train_idx, test_idx in TimeSeriesSplit(n_splits=n_splits).split(real):
        train = pd.concat([real.iloc[train_idx], simulated]).sort_values("startTime")
        test = real.iloc[test_idx]
        if train[TARGET].nunique() < 2:
            continue
        for name, (pred, prob) in predict_all(train, test, features, params).items():
            pooled.setdefault(name, ([], []))
            pooled[name][0].extend(pred)
            pooled[name][1].extend(prob)
        truth.extend(test[TARGET])

    if not truth:
        return None
    scores = {name: score(truth, pred, prob) for name, (pred, prob) in pooled.items()}
    # A constant guess has no ranking ability. Pooling folds with different base
    # rates would otherwise give it a spurious AUC.
    scores["majority_class"]["roc_auc"] = None
    return {"n_splits": n_splits, "n_predictions": len(truth), **scores}


def export_tree_to_json(tree, counts, features, meta, parity, output_path):
    """Serialise the fitted tree so Node.js can walk it without Python."""
    structure = {
        **meta,
        "n_features": int(tree.n_features_in_),
        "n_nodes": int(tree.tree_.node_count),
        "max_depth": int(tree.tree_.max_depth),
        "feature_names": features,
        "class_names": CLASS_NAMES,
        "children_left": [int(x) for x in tree.tree_.children_left],
        "children_right": [int(x) for x in tree.tree_.children_right],
        "feature": [int(x) for x in tree.tree_.feature],
        "threshold": [float(t) for t in tree.tree_.threshold],
        # Raw training counts [failures, successes]. tree_.value is class-weighted
        # (class_weight='balanced'), so it cannot be read as a probability.
        "value": counts.tolist(),
        # The class scikit-learn predicts at each node (uses the class weights)
        "node_class": [int(np.argmax(v[0])) for v in tree.tree_.value],
        # Known inputs and outputs, re-checked by Node after every training run
        "parity_samples": parity,
    }
    with open(output_path, "w") as f:
        json.dump(structure, f, indent=2)
    print(f"[ML] Tree exported to {output_path} ({structure['n_nodes']} nodes)")


def date_range(frame):
    return {"from": frame["startTime"].min().isoformat(), "to": frame["startTime"].max().isoformat(), "n": len(frame)}


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
    args = parser.parse_args()
    warnings.filterwarnings("ignore")

    print("=" * 60)
    print("DistractFree - Decision Tree Training Pipeline")
    print("=" * 60)

    # -- 1. Load data ----------------------------------
    csv_path = DATA_DIR / "training_data.csv"
    if not csv_path.exists():
        print(f"\n[ERROR] {csv_path} not found.")
        print("        Run `node ml/extractTrainingData.js` first to build it from MongoDB.")
        sys.exit(1)

    print(f"\n[1/5] Loading dataset from {csv_path}")
    df = pd.read_csv(csv_path)
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df = df.sort_values("startTime").reset_index(drop=True)
    features = [c for c in df.columns if c not in META_COLUMNS + DERIVED_COLUMNS + [TARGET]]

    real = df[df["source"] == "real"].reset_index(drop=True)
    simulated = df[df["source"] == "simulated"] if args.include_simulated else df.iloc[0:0]
    trained_at = datetime.now(timezone.utc)
    print(f"      Real sessions: {len(real)}, simulated sessions used: {len(simulated)}")

    # -- Minimum-data guard ----------------------------
    if len(real) < args.min_real:
        print(f"\n[STOP] Only {len(real)} real sessions (< {args.min_real}). No model was trained.")
        write_report({
            "status": "insufficient_data",
            "trained_at": trained_at.isoformat(),
            "n_real": len(real),
            "n_simulated": len(simulated),
            "min_real_sessions": args.min_real,
        })
        return

    # -- 2. Time-based split ---------------------------
    split = int(len(real) * (1 - TEST_FRACTION))
    test = real.iloc[split:]
    train = pd.concat([real.iloc[:split], simulated]).sort_values("startTime").reset_index(drop=True)
    print(f"\n[2/5] Time-based split: train {len(train)} (oldest) / test {len(test)} (newest, real only)")

    if train[TARGET].nunique() < 2:
        print("\n[ERROR] The training period contains only one outcome; a classifier cannot be trained.")
        sys.exit(1)

    # -- 3. Hyperparameter search ----------------------
    n_splits = cv_splits(len(train))
    print(f"\n[3/5] Grid search with TimeSeriesSplit ({n_splits} folds)")
    grid = GridSearchCV(
        new_tree(),
        PARAM_GRID,
        cv=TimeSeriesSplit(n_splits=n_splits),
        scoring=CV_SCORING,
        n_jobs=1,
    )
    grid.fit(train[features], train[TARGET])
    best_params = grid.best_params_
    print(f"      Best params: {best_params}")
    print(f"      Best CV {CV_SCORING}: {grid.best_score_:.4f}")

    # -- 4. Train and evaluate -------------------------
    print("\n[4/5] Training final model and scoring on the held-out newest sessions")
    model = grid.best_estimator_
    counts = node_counts(model, train[features], train[TARGET])
    predictions = predict_all(train, test, features, best_params)
    metrics = {name: score(test[TARGET], pred, prob) for name, (pred, prob) in predictions.items()}
    forward = walk_forward(real, simulated, features, best_params)

    for name, m in metrics.items():
        print(f"      {name:<20} acc={m['accuracy']:.3f}  f1={m['f1']:.3f}  auc={m['roc_auc']}")

    importances = sorted(
        ({"feature": f, "importance": round(float(i), 4)} for f, i in zip(features, model.feature_importances_)),
        key=lambda x: -x["importance"],
    )

    # -- 5. Export -------------------------------------
    print("\n[5/5] Exporting model")
    model_version = f"dt-{trained_at.strftime('%Y%m%d%H%M%S')}"
    meta = {
        "model_version": model_version,
        "trained_at": trained_at.isoformat(),
        "n_real": len(real),
        "n_simulated": len(simulated),
        "n_train": len(train),
    }
    model_pred, model_prob = predictions["model"]
    parity = [
        {
            "features": [float(v) for v in test[features].iloc[i]],
            "probability": float(model_prob[i]),
            "predictedClass": int(model_pred[i]),
        }
        for i in range(len(test))
    ]
    export_tree_to_json(model, counts, features, meta, parity, MODEL_DIR / "decision_tree_model.json")
    joblib.dump(model, MODEL_DIR / "decision_tree_model.pkl")

    model_metrics = metrics.pop("model")
    write_report({
        "status": "trained",
        **meta,
        "task": "Pre-session prediction of sessionSuccess (binary)",
        "target": "status == 'completed' AND duration >= 0.9 * plannedDuration AND distractionAttempts <= 1",
        "evaluated_on": "real sessions only",
        "split": "time-based: oldest 80% of real sessions train, newest 20% test",
        "n_train_real": split,
        "n_test": len(test),
        "train_range": date_range(real.iloc[:split]),
        "test_range": date_range(test),
        "success_rate": {
            "train_real": round(float(real.iloc[:split][TARGET].mean()), 4),
            "test": round(float(test[TARGET].mean()), 4),
        },
        "class_names": CLASS_NAMES,
        "metrics": model_metrics,
        "baselines": metrics,
        # Stated plainly so nobody has to infer it: does the tree beat each baseline on the test set?
        "beats_baseline": {
            name: bool(model_metrics["accuracy"] > m["accuracy"]) for name, m in metrics.items()
        },
        "walk_forward": forward,
        "best_params": best_params,
        "cv": {"splitter": "TimeSeriesSplit", "n_splits": n_splits, "scoring": CV_SCORING,
               "best_score": round(float(grid.best_score_), 4)},
        "feature_names": features,
        "feature_importances": importances,
        "n_nodes": int(model.tree_.node_count),
        "max_depth": int(model.tree_.max_depth),
        "min_real_sessions": args.min_real,
    })

    print("\n[DONE] Training complete")


if __name__ == "__main__":
    main()
