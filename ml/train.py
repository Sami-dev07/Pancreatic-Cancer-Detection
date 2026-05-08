# ── SECTION 1: IMPORTS ────────────────────────────────────────────────────────
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable

import joblib
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from imblearn.over_sampling import SMOTE
from sklearn.base import BaseEstimator, ClassifierMixin, clone
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline

TF_IMPORT_ERROR: str | None = None
try:
    from tensorflow.keras.callbacks import EarlyStopping
    from tensorflow.keras.layers import Dense, Dropout
    from tensorflow.keras.models import Sequential

    TENSORFLOW_AVAILABLE = True
except Exception as import_exc:  
    TENSORFLOW_AVAILABLE = False
    TF_IMPORT_ERROR = f"{type(import_exc).__name__}: {import_exc}"
    Sequential = None 
    Dense = None  
    Dropout = None  
    EarlyStopping = None 

try:
    from xgboost import XGBClassifier as _XGBClassifier

    XGBClassifier: Any = _XGBClassifier
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBClassifier = None
    XGBOOST_AVAILABLE = False

# ── SECTION 2: PACKAGE PATH & PREPROCESS IMPORT ───────────────────────────────
_ML_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _ML_DIR.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from ml.preprocess import build_preprocessor, run_preprocessing

# ── SECTION 3: CONFIGURATION ──────────────────────────────────────────────────
DATA_PATH = "data/Debernardi et al 2020 data.csv"
MODEL_DIR = Path("models")
PLOTS_DIR = Path("plots")
MODEL_DIR.mkdir(exist_ok=True)
PLOTS_DIR.mkdir(exist_ok=True)

RANDOM_STATE = 42
TEST_SIZE = 0.2
CV_SPLITS = 5


# ── SECTION 4: KERAS ANN WRAPPER ──────────────────────────────────────────────
class KerasClassifierWrapper(BaseEstimator, ClassifierMixin):
   

    def __init__(
        self,
        epochs: int = 50,
        batch_size: int = 16,
        validation_split: float = 0.1,
        random_state: int = RANDOM_STATE,
        verbose: int = 0,
    ) -> None:
        self.epochs = epochs
        self.batch_size = batch_size
        self.validation_split = validation_split
        self.random_state = random_state
        self.verbose = verbose

    def _build_model(self) -> Any:
        """Construct the thesis Chapter 4.4 ANN architecture."""
        model = Sequential(
            [
                Dense(64, activation="relu"),
                Dropout(0.3),
                Dense(32, activation="relu"),
                Dropout(0.2),
                Dense(1, activation="sigmoid"),
            ]
        )
        model.compile(optimizer="adam", loss="binary_crossentropy", metrics=["accuracy"])
        return model

    def fit(self, X: np.ndarray, y: np.ndarray) -> KerasClassifierWrapper:
        """Build and train the Keras model on dense numeric inputs."""
        if not TENSORFLOW_AVAILABLE:
            raise RuntimeError("TensorFlow is not installed; cannot fit KerasClassifierWrapper.")

        rng = np.random.RandomState(self.random_state)
        seed = int(rng.randint(0, 2**31 - 1))

        import tensorflow as tf

        tf.random.set_seed(seed)

        self.model_ = self._build_model()
        self.classes_ = np.array([0, 1])
        self.n_features_in_ = X.shape[1]

        y_arr = np.asarray(y).astype(np.float32).reshape(-1, 1)
        early = EarlyStopping(patience=10, restore_best_weights=True)

        self.model_.fit(
            X,
            y_arr,
            epochs=self.epochs,
            batch_size=self.batch_size,
            validation_split=self.validation_split,
            verbose=self.verbose,
            callbacks=[early],
        )
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        """Return class labels using a 0.5 threshold on predicted probability."""
        proba = self.model_.predict(X, verbose=0).reshape(-1)
        return (proba >= 0.5).astype(int)

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Return shape (n_samples, 2) probabilities [[P(0), P(1)]]."""
        p1 = self.model_.predict(X, verbose=0).reshape(-1)
        p0 = 1.0 - p1
        return np.column_stack([p0, p1])


# ── SECTION 5: DATA HELPERS (COMPATIBILITY) ───────────────────────────────────
def load_data(path: str) -> pd.DataFrame:
    """Load the CSV dataset used across the project."""
    df = pd.read_csv(path)
    if df.empty:
        raise ValueError("Dataset is empty.")
    return df


def build_target(df: pd.DataFrame) -> pd.DataFrame:

    df = df.copy()

    if "diagnosis" not in df.columns:
        raise ValueError("Expected 'diagnosis' column was not found.")

    valid_values = {1, 2, 3}
    actual_values = set(df["diagnosis"].dropna().unique())

    if not actual_values.issubset(valid_values):
        raise ValueError(f"Unexpected diagnosis values found: {sorted(actual_values)}")

    df["target"] = (df["diagnosis"] == 3).astype(int)
    return df


def select_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
 
    target_col = "target"

    drop_cols = [
        "sample_id",
        "patient_cohort",
        "sample_origin",
        "diagnosis",
        "stage",
        "benign_sample_diagnosis",
        "REG1A",
    ]

    feature_cols = [c for c in df.columns if c not in drop_cols + [target_col]]

    X = df[feature_cols].copy()
    y = df[target_col].copy()

    if X.empty:
        raise ValueError("No usable feature columns remain.")

    return X, y


# ── SECTION 6: MODEL FACTORIES ────────────────────────────────────────────────
def build_models(y_train: pd.Series) -> dict[str, Any]:
  
    positive_count = int((y_train == 1).sum())
    negative_count = int((y_train == 0).sum())
    scale_pos_weight = negative_count / positive_count if positive_count > 0 else 1.0

    models: dict[str, Any] = {
        "dummy_baseline": DummyClassifier(strategy="most_frequent"),
        "logistic_regression": LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=RANDOM_STATE,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=300,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    }

    if XGBOOST_AVAILABLE and XGBClassifier is not None:
        models["xgboost"] = XGBClassifier(
            n_estimators=300,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="binary:logistic",
            eval_metric="logloss",
            scale_pos_weight=scale_pos_weight,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        )

    if TENSORFLOW_AVAILABLE:
        models["ann"] = KerasClassifierWrapper()

    return models


def _assemble_fitted_sklearn_pipeline(
    fitted_preprocessor: ColumnTransformer,
    fitted_classifier: Any,
) -> Pipeline:
 
    pipe = Pipeline(
        steps=[
            ("preprocessor", fitted_preprocessor),
            ("classifier", fitted_classifier),
        ]
    )
    return pipe


def evaluate_model(name: str, model: Any, X_test: Any, y_test: pd.Series) -> dict[str, Any]:
    y_pred = model.predict(X_test)

    metrics: dict[str, Any] = {
        "model": name,
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_test, y_pred, zero_division=0)),
        "mcc": float(matthews_corrcoef(y_test, y_pred)),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(
            y_test,
            y_pred,
            zero_division=0,
            output_dict=True,
        ),
    }

    if hasattr(model, "predict_proba"):
        y_proba = model.predict_proba(X_test)[:, 1]
        metrics["roc_auc"] = float(roc_auc_score(y_test, y_proba))
        metrics["pr_auc"] = float(average_precision_score(y_test, y_proba))
        metrics["brier_score"] = float(brier_score_loss(y_test, y_proba))

    return metrics


def print_metrics(metrics: dict[str, Any]) -> None:
    summary = {
        "accuracy": round(metrics["accuracy"], 4),
        "balanced_accuracy": round(metrics["balanced_accuracy"], 4),
        "precision": round(metrics["precision"], 4),
        "recall": round(metrics["recall"], 4),
        "f1_score": round(metrics["f1_score"], 4),
        "mcc": round(metrics["mcc"], 4),
        "roc_auc": round(metrics.get("roc_auc", 0.0), 4),
        "pr_auc": round(metrics.get("pr_auc", 0.0), 4),
        "brier_score": round(metrics.get("brier_score", 0.0), 4),
    }
    print(json.dumps(summary, indent=2))
    print("Confusion matrix:", metrics["confusion_matrix"])


def cross_val_smote_roc(
    X_train_raw: pd.DataFrame,
    y_train_raw: pd.Series,
    classifier_factory: Callable[[], Any],
    preprocessor_template: ColumnTransformer,
) -> float:
   
    cv = StratifiedKFold(n_splits=CV_SPLITS, shuffle=True, random_state=RANDOM_STATE)
    fold_scores: list[float] = []

    y_train_np = y_train_raw.to_numpy()

    for train_idx, val_idx in cv.split(X_train_raw, y_train_raw):
        X_tr = X_train_raw.iloc[train_idx]
        y_tr = y_train_np[train_idx]
        X_va = X_train_raw.iloc[val_idx]
        y_va = y_train_np[val_idx]

        prep = clone(preprocessor_template)
        prep.fit(X_tr)

        X_tr_t = prep.transform(X_tr)
        X_va_t = prep.transform(X_va)
        if hasattr(X_tr_t, "toarray"):
            X_tr_t = X_tr_t.toarray()
        if hasattr(X_va_t, "toarray"):
            X_va_t = X_va_t.toarray()

        n_min = int(min((y_tr == 0).sum(), (y_tr == 1).sum()))
        k_neighbors = max(1, min(5, n_min - 1)) if n_min > 1 else 1
        try:
            smote = SMOTE(random_state=RANDOM_STATE, k_neighbors=k_neighbors)
            X_res, y_res = smote.fit_resample(X_tr_t, y_tr)
        except ValueError:
            X_res, y_res = X_tr_t, y_tr

        clf = classifier_factory()
        clf.fit(X_res, y_res)

        if hasattr(clf, "predict_proba"):
            y_prob = clf.predict_proba(X_va_t)[:, 1]
        else:
            y_prob = clf.predict(X_va_t).astype(float)

        fold_scores.append(float(roc_auc_score(y_va, y_prob)))

    return float(np.mean(fold_scores))


# ── SECTION 7: PLOTTING ─────────────────────────────────────────────────────────
def _plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    title: str,
    out_path: Path,
) -> None:
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(6, 5))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=True)
    plt.xlabel("Predicted label")
    plt.ylabel("True label")
    plt.title(title)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()


def generate_training_plots(
    results_main: dict[str, dict[str, Any]],
    fitted_sklearn: dict[str, Pipeline],
    ann_wrapper: KerasClassifierWrapper | None,
    X_test_raw: pd.DataFrame,
    y_test: pd.Series,
    X_test_t: np.ndarray,
    counts_before: dict[str, int],
    counts_after: dict[str, int],
) -> None:
   
    y_test_np = y_test.to_numpy()

    # Confusion matrices for LR, RF, XGB
    cm_map = [
        ("logistic_regression", PLOTS_DIR / "confusion_matrix_lr.png", "Logistic Regression"),
        ("random_forest", PLOTS_DIR / "confusion_matrix_rf.png", "Random Forest"),
        ("xgboost", PLOTS_DIR / "confusion_matrix_xgb.png", "XGBoost"),
    ]
    for key, path, label in cm_map:
        if key not in fitted_sklearn:
            continue
        pipe = fitted_sklearn[key]
        y_pred = pipe.predict(X_test_raw)
        _plot_confusion_matrix(
            y_test_np,
            y_pred,
            f"Confusion Matrix - {label}",
            path,
        )

    if ann_wrapper is not None and TENSORFLOW_AVAILABLE:
        y_pred_ann = ann_wrapper.predict(X_test_t)
        _plot_confusion_matrix(
            y_test_np,
            y_pred_ann,
            "Confusion Matrix - Artificial Neural Network",
            PLOTS_DIR / "confusion_matrix_ann.png",
        )

    # ROC curves (all available)
    plt.figure(figsize=(8, 6))
    for key, label in [
        ("logistic_regression", "Logistic Regression"),
        ("random_forest", "Random Forest"),
        ("xgboost", "XGBoost"),
    ]:
        if key not in fitted_sklearn:
            continue
        pipe = fitted_sklearn[key]
        if not hasattr(pipe, "predict_proba"):
            continue
        proba = pipe.predict_proba(X_test_raw)[:, 1]
        fpr, tpr, _ = roc_curve(y_test_np, proba)
        auc_v = roc_auc_score(y_test_np, proba)
        plt.plot(fpr, tpr, label=f"{label} (AUC = {auc_v:.3f})")

    if ann_wrapper is not None and TENSORFLOW_AVAILABLE:
        proba = ann_wrapper.predict_proba(X_test_t)[:, 1]
        fpr, tpr, _ = roc_curve(y_test_np, proba)
        auc_v = roc_auc_score(y_test_np, proba)
        plt.plot(fpr, tpr, label=f"Artificial Neural Network (AUC = {auc_v:.3f})")

    plt.plot([0, 1], [0, 1], "k--", linewidth=1)
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("ROC Curves - Test Set")
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "roc_curves.png", dpi=150)
    plt.close()

    # Feature importances RF / XGB
    def _plot_importance_bar(
        pipe: Pipeline,
        out_file: Path,
        chart_title: str,
    ) -> None:
        pre = pipe.named_steps.get("preprocessor")
        clf = pipe.named_steps.get("classifier")
        if pre is None or clf is None or not hasattr(clf, "feature_importances_"):
            return
        names = pre.get_feature_names_out()
        imp = clf.feature_importances_
        order = np.argsort(imp)[::-1][:15]
        plt.figure(figsize=(9, 6))
        sns.barplot(x=imp[order], y=names[order], orient="h")
        plt.xlabel("Importance")
        plt.ylabel("Feature")
        plt.title(chart_title)
        plt.tight_layout()
        plt.savefig(out_file, dpi=150)
        plt.close()

    if "random_forest" in fitted_sklearn:
        _plot_importance_bar(
            fitted_sklearn["random_forest"],
            PLOTS_DIR / "feature_importance_rf.png",
            "Random Forest - Top 15 Feature Importances",
        )
    if "xgboost" in fitted_sklearn:
        _plot_importance_bar(
            fitted_sklearn["xgboost"],
            PLOTS_DIR / "feature_importance_xgb.png",
            "XGBoost - Top 15 Feature Importances",
        )

    # Class distribution before / after SMOTE
    classes = ["Class 0 (non-PDAC)", "Class 1 (PDAC)"]
    before_vals = [counts_before.get("0", 0), counts_before.get("1", 0)]
    after_vals = [counts_after.get("0", 0), counts_after.get("1", 0)]
    x = np.arange(len(classes))
    width = 0.35
    plt.figure(figsize=(8, 5))
    plt.bar(x - width / 2, before_vals, width, label="Before SMOTE")
    plt.bar(x + width / 2, after_vals, width, label="After SMOTE")
    plt.ylabel("Count")
    plt.title("Class Distribution Before and After SMOTE (Training Split)")
    plt.xticks(x, classes)
    plt.legend()
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "class_distribution.png", dpi=150)
    plt.close()

    # Model comparison grouped bars
    labels_models = [
        "Logistic Regression",
        "Random Forest",
        "XGBoost",
        "Artificial Neural Network",
    ]
    keys_order = ["logistic_regression", "random_forest", "xgboost", "ann"]
    acc: list[float] = []
    prec: list[float] = []
    rec: list[float] = []
    f1s: list[float] = []
    for k in keys_order:
        if k not in results_main:
            acc.append(0.0)
            prec.append(0.0)
            rec.append(0.0)
            f1s.append(0.0)
            continue
        m = results_main[k]
        acc.append(float(m.get("accuracy", 0.0)))
        prec.append(float(m.get("precision", 0.0)))
        rec.append(float(m.get("recall", 0.0)))
        f1s.append(float(m.get("f1_score", 0.0)))

    x_m = np.arange(len(labels_models))
    bw = 0.2
    plt.figure(figsize=(11, 6))
    plt.bar(x_m - 1.5 * bw, acc, bw, label="Accuracy")
    plt.bar(x_m - 0.5 * bw, prec, bw, label="Precision")
    plt.bar(x_m + 0.5 * bw, rec, bw, label="Recall")
    plt.bar(x_m + 1.5 * bw, f1s, bw, label="F1-Score")
    plt.xticks(x_m, labels_models, rotation=15, ha="right")
    plt.ylabel("Score")
    plt.ylim(0, 1.05)
    plt.title("Model Comparison - Test Set Metrics")
    plt.legend()
    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "model_comparison.png", dpi=150)
    plt.close()


# ── SECTION 8: MAIN TRAINING ROUTINE ──────────────────────────────────────────
def _factory_for_model(models_map: dict[str, Any], model_name: str) -> Callable[[], Any]:
    """Build a zero-arg factory that clones the named estimator (for CV)."""

    def factory() -> Any:
        return clone(models_map[model_name])

    return factory


def main() -> dict[str, Any]:
    """Train all models, evaluate, save artifacts, metrics, and comparison table."""
    print("\n[Pancreatic Cancer Detection] Loading and preprocessing (ColumnTransformer + SMOTE)...")

    (
        X_train_res,
        y_train_res,
        X_test_t,
        y_test_arr,
        feature_names,
        fitted_preprocessor,
        X_train_raw,
        X_test_raw,
        y_train_raw,
        y_test_raw,
        counts_before,
        counts_after,
    ) = run_preprocessing()

    y_test = pd.Series(y_test_arr, name="target")
    y_train_series = y_train_raw.reset_index(drop=True)

    print("\nDataset summary:")
    print(f"  Raw feature columns: {feature_names}")
    print(f"  Train (raw rows): {X_train_raw.shape[0]}  Test: {X_test_raw.shape[0]}")

    if TENSORFLOW_AVAILABLE:
        print("\n[ANN] TensorFlow imported successfully; Keras ANN will be trained.")
    else:
        print("\n[ANN] TensorFlow NOT available — ANN row will show N/A in the comparison table.")
        if TF_IMPORT_ERROR:
            print(f"      Reason: {TF_IMPORT_ERROR}")
        print(
            "      Fix: use Python 3.10–3.12 (64-bit), then: python -m pip install tensorflow"
        )

    models = build_models(y_train_series)
    preprocessor_template = build_preprocessor(X_train_raw)

    cv_scores: dict[str, dict[str, float]] = {}
    print("\n--- Model selection: stratified CV (SMOTE inside each train fold) ---")
    for name, _classifier in models.items():
        if name == "dummy_baseline":
            continue
        if name == "ann" and not TENSORFLOW_AVAILABLE:
            print(f"  {name}: skipped (TensorFlow not installed).")
            continue

        print(f"  Computing CV ROC-AUC for: {name} ...")
        roc_mean = cross_val_smote_roc(
            X_train_raw,
            y_train_series,
            _factory_for_model(models, name),
            preprocessor_template,
        )
        cv_scores[name] = {"roc_auc_mean": roc_mean}
        print(f"  {name}: CV ROC-AUC mean={roc_mean:.4f}")

    eligible = [k for k in cv_scores if k not in {"dummy_baseline"}]
    best_model_name = (
        max(eligible, key=lambda m: cv_scores[m]["roc_auc_mean"]) if eligible else "logistic_regression"
    )
    print(f"\nBest model by CV (train split): {best_model_name}")

    results: dict[str, dict[str, Any]] = {}
    fitted_sklearn: dict[str, Pipeline] = {}
    ann_wrapper: KerasClassifierWrapper | None = None

    print("\n--- Fit all models on SMOTE-transformed training data; evaluate on test ---")
    for name, classifier in models.items():
        print(f"\nTraining: {name}")

        if name == "dummy_baseline":
            clf = clone(classifier)
            clf.fit(X_train_res, y_train_res)
            eval_metrics = evaluate_model(name, clf, X_test_t, y_test)
            results[name] = eval_metrics
            print_metrics(eval_metrics)
            continue

        if name == "ann":
            if not TENSORFLOW_AVAILABLE:
                print("  [SKIP] TensorFlow not available - ANN not trained.")
                continue
            try:
                clf_k = clone(classifier)
                clf_k.fit(X_train_res, y_train_res)
                ann_wrapper = clf_k
                ann_path = MODEL_DIR / "ann_model.keras"
                clf_k.model_.save(ann_path)
                print(f"  [SAVED] Keras ANN -> {ann_path}")
                eval_metrics = evaluate_model(name, clf_k, X_test_t, y_test)
                results[name] = eval_metrics
                print_metrics(eval_metrics)
            except Exception as ann_exc:
                print(f"  [ERROR] ANN training failed: {type(ann_exc).__name__}: {ann_exc}")
                print("          ANN metrics will show N/A; sklearn models above are still valid.")
            continue

        clf = clone(classifier)
        clf.fit(X_train_res, y_train_res)
        pipe = _assemble_fitted_sklearn_pipeline(fitted_preprocessor, clf)
        fitted_sklearn[name] = pipe
        eval_metrics = evaluate_model(name, pipe, X_test_raw, y_test)
        results[name] = eval_metrics
        print_metrics(eval_metrics)

    # Thesis comparison table (four primary models)
    results_four = {k: results[k] for k in ["logistic_regression", "random_forest", "xgboost", "ann"] if k in results}

    table_rows: list[tuple[str, str, str, str, str, str]] = []
    display_order = [
        ("logistic_regression", "Logistic Regression"),
        ("random_forest", "Random Forest"),
        ("xgboost", "XGBoost"),
        ("ann", "Artificial Neural Network"),
    ]
    print("\n--- Comparison table (test set) ---")
    print("| Model                        | Accuracy | Precision | Recall | F1   | ROC-AUC |")
    for key, display in display_order:
        if key not in results:
            table_rows.append((display, "N/A", "N/A", "N/A", "N/A", "N/A"))
            print(f"| {display:28} | N/A      | N/A       | N/A    | N/A  | N/A     |")
            continue
        m = results[key]
        roc_cell = f"{float(m['roc_auc']):.4f}" if m.get("roc_auc") is not None else "N/A"
        row = (
            display,
            f"{m['accuracy']:.4f}",
            f"{m['precision']:.4f}",
            f"{m['recall']:.4f}",
            f"{m['f1_score']:.4f}",
            roc_cell,
        )
        table_rows.append(row)
        print(
            f"| {display:28} | {row[1]:8} | {row[2]:9} | {row[3]:6} | {row[4]:4} | {row[5]:7} |"
        )

    table_path = MODEL_DIR / "comparison_table.txt"
    with open(table_path, "w", encoding="utf-8") as f:
        f.write("| Model                        | Accuracy | Precision | Recall | F1   | ROC-AUC |\n")
        for r in table_rows:
            f.write(f"| {r[0]:28} | {r[1]:8} | {r[2]:9} | {r[3]:6} | {r[4]:4} | {r[5]:7} |\n")
    print(f"\n[SAVED] {table_path}")

    if "logistic_regression" in fitted_sklearn:
        joblib.dump(fitted_sklearn["logistic_regression"], MODEL_DIR / "model_lr.joblib")
    if "random_forest" in fitted_sklearn:
        joblib.dump(fitted_sklearn["random_forest"], MODEL_DIR / "model_rf.joblib")
    if "xgboost" in fitted_sklearn:
        joblib.dump(fitted_sklearn["xgboost"], MODEL_DIR / "model_xgb.joblib")

    sklearn_candidates = {
        k: v for k, v in fitted_sklearn.items() if k in {"logistic_regression", "random_forest", "xgboost"}
    }
    if best_model_name in fitted_sklearn and best_model_name != "ann":
        best_pipeline = fitted_sklearn[best_model_name]
    else:
        if not sklearn_candidates:
            raise RuntimeError("No sklearn classifier pipelines were trained; cannot save best_pipeline.joblib.")
        best_sklearn_name = max(
            sklearn_candidates,
            key=lambda m: cv_scores.get(m, {}).get("roc_auc_mean", 0.0),
        )
        best_pipeline = fitted_sklearn[best_sklearn_name]
        print(
            f"\nBest CV pick is ANN or unavailable as Pipeline; "
            f"saving best sklearn model by CV: {best_sklearn_name}"
        )

    print(f"\nSaving best_pipeline.joblib (train CV selection: {best_model_name})")
    joblib.dump(best_pipeline, MODEL_DIR / "best_pipeline.joblib")

    ann_exists = (MODEL_DIR / "ann_model.keras").is_file()
    metadata = {
        "data_path": DATA_PATH,
        "target_definition": "1 = PDAC (diagnosis == 3), 0 = non-PDAC (diagnosis in [1, 2])",
        "feature_columns": list(feature_names),
        "best_model": best_model_name,
        "model_selection": {
            "method": f"{CV_SPLITS}-fold_stratified_CV_train_only_SMOTE_inside_each_fold",
            "primary_metric": "roc_auc_mean",
            "cv_scores": cv_scores,
        },
        "models_trained": [k for k in models if k != "dummy_baseline"],
        "train_size": int(len(X_train_raw)),
        "test_size": int(len(X_test_raw)),
        "class_counts_train": y_train_series.value_counts().to_dict(),
        "class_counts_test": y_test.value_counts().to_dict(),
        "models_available": ["lr", "rf", "xgb", "ann"],
        "ann_path": "models/ann_model.keras" if ann_exists else None,
        "comparison_table_path": table_path.as_posix(),
    }

    with open(MODEL_DIR / "metrics.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    with open(MODEL_DIR / "metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved pipeline to: {MODEL_DIR / 'best_pipeline.joblib'}")
    print(f"Saved metrics to: {MODEL_DIR / 'metrics.json'}")
    print(f"Saved metadata to: {MODEL_DIR / 'metadata.json'}")

    return {
        "results_four": results_four,
        "fitted_sklearn": fitted_sklearn,
        "ann_wrapper": ann_wrapper,
        "X_test_raw": X_test_raw,
        "y_test": y_test,
        "X_test_t": X_test_t,
        "counts_before": counts_before,
        "counts_after": counts_after,
    }


if __name__ == "__main__":
    ctx = main()
    if ctx is not None:
        print("\n--- Generating plots ---")
        generate_training_plots(
            ctx["results_four"],
            ctx["fitted_sklearn"],
            ctx["ann_wrapper"],
            ctx["X_test_raw"],
            ctx["y_test"],
            ctx["X_test_t"],
            ctx["counts_before"],
            ctx["counts_after"],
        )
        print(f"[SAVED] Plot PNGs under {PLOTS_DIR}/")
