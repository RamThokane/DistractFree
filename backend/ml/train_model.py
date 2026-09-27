"""
DistractFree — Decision Tree Training Pipeline
================================================

Trains a scikit-learn DecisionTreeClassifier on browsing behaviour data
and exports the tree structure as JSON for Node.js inference.

Usage:
    python ml/train_model.py

Outputs:
    ml/model/decision_tree_model.json
    ml/model/decision_tree_model.pkl   (Python pickle for re-use)
    ml/model/training_report.json      (metrics & confusion matrix)
"""

import json
import os
import sys
import numpy as np
import pandas as pd
from pathlib import Path

from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
)
import joblib

# ── Paths ───────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
DATA_DIR = BASE_DIR / "data"
MODEL_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)

# ── Feature & label definitions ─────────────────────
TIME_OF_DAY_MAP = {"morning": 0, "afternoon": 1, "evening": 2, "night": 3}
CATEGORY_MAP = {
    "social_media": 0,
    "entertainment": 1,
    "news": 2,
    "shopping": 3,
    "gaming": 4,
    "streaming": 5,
    "messaging": 6,
    "other": 7,
}
RISK_LABELS = ["low", "medium", "high"]
REAL_SAMPLE_WEIGHT = 3.0  # real sessions count more than synthetic padding


def export_tree_to_json(tree: DecisionTreeClassifier, output_path: Path):
    """
    Serialise the fitted tree into a JSON structure that the Node.js
    runtime can traverse without any Python dependencies.
    """
    tree_structure = {
        "n_features": int(tree.n_features_in_),
        "n_classes": int(tree.n_classes_),
        "n_nodes": int(tree.tree_.node_count),
        "max_depth": int(tree.tree_.max_depth),
        "feature_names": [
            "timeOfDay",
            "websiteCategory",
            "sessionDuration",
            "previousDistractions",
            "focusScore",
        ],
        "class_names": RISK_LABELS,
        "children_left": [int(x) for x in tree.tree_.children_left],
        "children_right": [int(x) for x in tree.tree_.children_right],
        "feature": [int(x) for x in tree.tree_.feature],
        "threshold": [round(float(t), 6) for t in tree.tree_.threshold],
        # Per-node class distribution as integers (per-mille). sklearn >= 1.4
        # stores fractions in tree_.value, so int() alone would zero them out;
        # normalising also keeps class weights/sample weights consistent.
        "value": [
            [[int(round(c / max(sum(classes), 1e-12) * 1000)) for c in classes] for classes in node]
            for node in tree.tree_.value
        ],
    }

    with open(output_path, "w") as f:
        json.dump(tree_structure, f, indent=2)

    print(f"[ML] Tree exported to {output_path} ({tree_structure['n_nodes']} nodes)")


def main():
    print("=" * 60)
    print("DistractFree — Decision Tree Training Pipeline")
    print("=" * 60)

    # ── 1. Load data ────────────────────────────────
    csv_path = DATA_DIR / "training_data.csv"

    if not csv_path.exists():
        print(f"\n[ERROR] {csv_path} not found.")
        print("        Run `node backend/ml/extractTrainingData.js` first to build it from MongoDB.")
        sys.exit(1)

    print(f"\n[1/5] Loading dataset from {csv_path}")
    df = pd.read_csv(csv_path)
    # Encode categorical columns if present as strings
    if df["timeOfDay"].dtype == object:
        df["timeOfDay"] = df["timeOfDay"].map(TIME_OF_DAY_MAP)
    if df["websiteCategory"].dtype == object:
        df["websiteCategory"] = df["websiteCategory"].map(CATEGORY_MAP)

    # Real rows get more weight than synthetic padding
    if "source" not in df.columns:
        df["source"] = "real"
    weights = np.where(df["source"] == "real", REAL_SAMPLE_WEIGHT, 1.0)
    print(f"      Real rows: {(df['source'] == 'real').sum()}, synthetic rows: {(df['source'] != 'real').sum()}")

    print(f"      Dataset shape: {df.shape}")
    print(f"      Class distribution:\n{df['distractionRisk'].value_counts().to_string()}")

    # ── 2. Prepare features & labels ────────────────
    X = df[["timeOfDay", "websiteCategory", "sessionDuration", "previousDistractions", "focusScore"]]
    # Explicit encoding (LabelEncoder sorts alphabetically, which would break the
    # low=0 / medium=1 / high=2 order that class_names and decisionTreeModel.js rely on)
    y = df["distractionRisk"].map({label: i for i, label in enumerate(RISK_LABELS)}).to_numpy()

    X_train, X_test, y_train, y_test, w_train, _ = train_test_split(
        X, y, weights, test_size=0.2, random_state=42, stratify=y
    )
    print(f"\n[2/5] Train/test split: {len(X_train)} / {len(X_test)}")

    # ── 3. Hyperparameter tuning via grid search ────
    print("\n[3/5] Running grid search for optimal hyperparameters…")
    param_grid = {
        "max_depth": [3, 5, 7, 10, 15, None],
        "min_samples_split": [2, 5, 10, 20],
        "min_samples_leaf": [1, 2, 5, 10],
        "criterion": ["gini", "entropy"],
    }

    grid = GridSearchCV(
        DecisionTreeClassifier(random_state=42, class_weight="balanced"),
        param_grid,
        cv=5,
        scoring="accuracy",
        n_jobs=-1,
        verbose=0,
    )
    grid.fit(X_train, y_train, sample_weight=w_train)

    best_params = grid.best_params_
    print(f"      Best params: {best_params}")
    print(f"      Best CV accuracy: {grid.best_score_:.4f}")

    # ── 4. Train final model ────────────────────────
    print("\n[4/5] Training final model with best parameters…")
    model = DecisionTreeClassifier(random_state=42, class_weight="balanced", **best_params)
    model.fit(X_train, y_train, sample_weight=w_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=RISK_LABELS, output_dict=True)
    cm = confusion_matrix(y_test, y_pred)

    cv_scores = cross_val_score(model, X, y, cv=5, scoring="accuracy")

    print(f"      Test accuracy: {accuracy:.4f}")
    print(f"      5-fold CV mean: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
    print(f"\n{classification_report(y_test, y_pred, target_names=RISK_LABELS)}")

    # ── 5. Export ───────────────────────────────────
    print("[5/5] Exporting model…")

    # JSON for Node.js runtime
    export_tree_to_json(model, MODEL_DIR / "decision_tree_model.json")

    # Pickle for Python re-use
    joblib.dump(model, MODEL_DIR / "decision_tree_model.pkl")
    print(f"      Pickle saved to {MODEL_DIR / 'decision_tree_model.pkl'}")

    # Training report
    training_report = {
        "accuracy": round(accuracy, 4),
        "cv_mean": round(float(cv_scores.mean()), 4),
        "cv_std": round(float(cv_scores.std()), 4),
        "n_real": int((df["source"] == "real").sum()),
        "n_synthetic": int((df["source"] != "real").sum()),
        "best_params": best_params,
        "classification_report": report,
        "confusion_matrix": cm.tolist(),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "n_features": int(model.n_features_in_),
        "n_nodes": int(model.tree_.node_count),
        "max_depth_actual": int(model.tree_.max_depth),
    }

    with open(MODEL_DIR / "training_report.json", "w") as f:
        json.dump(training_report, f, indent=2)
    print(f"      Report saved to {MODEL_DIR / 'training_report.json'}")

    print("\n[DONE] Training complete!")


if __name__ == "__main__":
    main()
