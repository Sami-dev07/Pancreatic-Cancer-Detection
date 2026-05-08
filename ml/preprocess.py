# ── SECTION 1: IMPORTS ────────────────────────────────────────────────────────
import json
import os
from typing import Any

import joblib
import numpy as np
import pandas as pd
from imblearn.over_sampling import SMOTE
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# ── SECTION 2: CONFIGURATION ──────────────────────────────────────────────────
SEED = 42
TEST_SIZE = 0.20
DATA_PATH = "data/Debernardi et al 2020 data.csv"
MODELS_DIR = "models"

DROP_COLS = [
    "sample_id",
    "patient_cohort",
    "sample_origin",
    "stage",
    "benign_sample_diagnosis",
    "REG1A",
    "diagnosis",
]


# ── SECTION 3: DATA LOADING ───────────────────────────────────────────────────
def load_data(path: str = DATA_PATH) -> pd.DataFrame:
    """
    Load the Debernardi et al. dataset from CSV.

    Returns:
        The raw dataset as a DataFrame.
    """
    try:
        df = pd.read_csv(path)
        print(f"[INFO] Dataset loaded: {df.shape[0]} rows × {df.shape[1]} cols")
        return df
    except FileNotFoundError as exc:
        raise FileNotFoundError(
            f"[ERROR] Dataset not found at '{path}'.\n"
            "        Place the original dataset in data/ and verify the filename."
        ) from exc


def build_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    
    if "diagnosis" not in df.columns:
        raise ValueError("Expected 'diagnosis' column was not found.")

    valid_mask = df["diagnosis"].isin([1, 2, 3])
    n_dropped = int((~valid_mask).sum())
    if n_dropped:
        print(f"[INFO] Dropping {n_dropped} row(s) with diagnosis not in [1, 2, 3].")
    df = df.loc[valid_mask].copy()

    y = (df["diagnosis"] == 3).astype(int)
    cols_to_drop = [c for c in DROP_COLS if c in df.columns]
    X = df.drop(columns=cols_to_drop)

    print(
        f"[INFO] Target distribution -> PDAC (1): {int(y.sum())}  |  "
        f"non-PDAC (0): {int((y == 0).sum())}"
    )
    print(f"[INFO] Raw feature columns ({X.shape[1]}): {list(X.columns)}")
    return X, y


# ── SECTION 4: PREPROCESSING BUILDERS ───────────────────────────────────────
def build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:

    categorical_features = X.select_dtypes(include=["object", "string"]).columns.tolist()
    numeric_features = X.select_dtypes(exclude=["object", "string"]).columns.tolist()

    numeric_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_pipeline, numeric_features),
            ("cat", categorical_pipeline, categorical_features),
        ]
    )

    return preprocessor


def _numeric_imputer_and_scaler(preprocessor: ColumnTransformer) -> tuple[Any, Any]:
    
    num_pipe = preprocessor.named_transformers_["num"]
    imputer = num_pipe.named_steps["imputer"]
    scaler = num_pipe.named_steps["scaler"]
    return imputer, scaler


# ── SECTION 5: MAIN PREPROCESSING PIPELINE ────────────────────────────────────
def run_preprocessing() -> tuple[
    np.ndarray,
    np.ndarray,
    np.ndarray,
    np.ndarray,
    list[str],
    ColumnTransformer,
    pd.DataFrame,
    pd.DataFrame,
    pd.Series,
    pd.Series,
    dict[str, int],
    dict[str, int],
]:
   
    os.makedirs(MODELS_DIR, exist_ok=True)

    df = load_data()
    X, y = build_features(df)
    feature_names = list(X.columns)

    X_train_raw, X_test_raw, y_train_raw, y_test_raw = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        random_state=SEED,
        stratify=y,
    )
    print(
        f"\n[INFO] Train: {X_train_raw.shape[0]} samples  |  "
        f"Test: {X_test_raw.shape[0]} samples"
    )

    preprocessor = build_preprocessor(X_train_raw)
    preprocessor.fit(X_train_raw)

    X_train_t = preprocessor.transform(X_train_raw)
    X_test_t = preprocessor.transform(X_test_raw)

    if hasattr(X_train_t, "toarray"):
        X_train_t = X_train_t.toarray()
    if hasattr(X_test_t, "toarray"):
        X_test_t = X_test_t.toarray()

    y_train_arr = y_train_raw.to_numpy()
    y_test_arr = y_test_raw.to_numpy()

    counts_before = {
        str(k): int(v) for k, v in zip(*np.unique(y_train_arr, return_counts=True))
    }
    print(f"\n[INFO] Class distribution BEFORE SMOTE -> {counts_before}")

    n_class_0 = int((y_train_arr == 0).sum())
    n_class_1 = int((y_train_arr == 1).sum())
    n_minority = min(n_class_0, n_class_1)
    k_neighbors = max(1, min(5, n_minority - 1)) if n_minority > 1 else 1
    try:
        smote = SMOTE(random_state=SEED, k_neighbors=k_neighbors)
        X_train_res, y_train_res = smote.fit_resample(X_train_t, y_train_arr)
    except ValueError as exc:
        print(f"[WARN] SMOTE failed ({exc}); using un-resampled training data.")
        X_train_res, y_train_res = X_train_t, y_train_arr

    counts_after = {
        str(k): int(v) for k, v in zip(*np.unique(y_train_res, return_counts=True))
    }
    print(f"[INFO] Class distribution AFTER SMOTE  -> {counts_after}")

    imputer_ref, scaler_ref = _numeric_imputer_and_scaler(preprocessor)
    joblib.dump(imputer_ref, os.path.join(MODELS_DIR, "imputer.pkl"))
    joblib.dump(scaler_ref, os.path.join(MODELS_DIR, "scaler.pkl"))
    joblib.dump(preprocessor, os.path.join(MODELS_DIR, "preprocessor.joblib"))
    print(f"\n[SAVED] imputer.pkl, scaler.pkl, preprocessor.joblib  ->  {MODELS_DIR}/")

    config: dict[str, Any] = {
        "feature_names": feature_names,
        "transformed_feature_names": list(preprocessor.get_feature_names_out()),
        "test_size": TEST_SIZE,
        "seed": SEED,
        "n_train_raw": int(X_train_raw.shape[0]),
        "n_test": int(X_test_raw.shape[0]),
        "n_train_smote": int(X_train_res.shape[0]),
        "class_counts_before_smote": counts_before,
        "class_counts_after_smote": counts_after,
    }
    with open(os.path.join(MODELS_DIR, "model_config.json"), "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    print(f"[SAVED] model_config.json  ->  {MODELS_DIR}/")

    print("\n[DONE] Preprocessing complete.\n")

    return (
        X_train_res,
        y_train_res,
        X_test_t,
        y_test_arr,
        feature_names,
        preprocessor,
        X_train_raw,
        X_test_raw,
        y_train_raw,
        y_test_raw,
        counts_before,
        counts_after,
    )


if __name__ == "__main__":
    run_preprocessing()
