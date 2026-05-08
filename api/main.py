# ── SECTION 1: IMPORTS ─────────────────────────────────────────────────────────
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import math

try:
    from tensorflow import keras

    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    keras = None  

BASE_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = BASE_DIR / "models"
PLOTS_DIR = BASE_DIR / "plots"

PIPELINE_PATH = MODELS_DIR / "best_pipeline.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessor.joblib"
METADATA_PATH = MODELS_DIR / "metadata.json"
METRICS_PATH = MODELS_DIR / "metrics.json"
FEATURE_INFO_PATH = MODELS_DIR / "feature_info.json"
DATA_PATH = BASE_DIR / "data" / "Debernardi et al 2020 data.csv"

MODEL_PATH_LR = MODELS_DIR / "model_lr.joblib"
MODEL_PATH_RF = MODELS_DIR / "model_rf.joblib"
MODEL_PATH_XGB = MODELS_DIR / "model_xgb.joblib"
MODEL_PATH_ANN = MODELS_DIR / "ann_model.keras"

logger = logging.getLogger(__name__)

# ── SECTION 2: MODEL REGISTRY & METADATA ───────────────────────────────────────
MODEL_REGISTRY: dict[str, Any | None] = {"lr": None, "rf": None, "xgb": None, "ann": None}

MODEL_METADATA: dict[str, dict[str, str]] = {
    "lr": {
        "name": "Logistic Regression",
        "description": "Interpretable baseline - good for low-risk screening",
    },
    "rf": {
        "name": "Random Forest",
        "description": "Robust ensemble - handles non-linear patterns well",
    },
    "xgb": {
        "name": "XGBoost",
        "description": "Gradient boosted trees - high precision on structured data",
    },
    "ann": {
        "name": "Artificial Neural Network",
        "description": "Deep learning - highest recall, best for catching high-risk patients",
    },
}

active_model_key: str = "ann"
_fitted_preprocessor: Any | None = None

_schema_cache_key: tuple[float | None, float | None] | None = None
_cached_field_schema: list[dict[str, Any]] | None = None

_explain_cache_key: float | None = None
_cached_explain_stats: dict[str, dict[str, Any]] | None = None


# ── SECTION 3: MODEL LOADING & PREDICTION HELPERS ─────────────────────────────


def load_model_registry() -> None:
    """
    Load sklearn pipelines, Keras ANN, preprocessor, and choose default active model.

    Missing files are logged and left as None so startup never crashes.
    """
    global MODEL_REGISTRY, _fitted_preprocessor, active_model_key

    MODEL_REGISTRY = {"lr": None, "rf": None, "xgb": None, "ann": None}

    if MODEL_PATH_LR.exists():
        try:
            MODEL_REGISTRY["lr"] = joblib.load(MODEL_PATH_LR)
        except OSError as exc:
            logger.warning("Could not load %s: %s", MODEL_PATH_LR, exc)
    if MODEL_PATH_RF.exists():
        try:
            MODEL_REGISTRY["rf"] = joblib.load(MODEL_PATH_RF)
        except OSError as exc:
            logger.warning("Could not load %s: %s", MODEL_PATH_RF, exc)
    if MODEL_PATH_XGB.exists():
        try:
            MODEL_REGISTRY["xgb"] = joblib.load(MODEL_PATH_XGB)
        except OSError as exc:
            logger.warning("Could not load %s: %s", MODEL_PATH_XGB, exc)

    if TENSORFLOW_AVAILABLE and keras is not None and MODEL_PATH_ANN.exists():
        try:
            MODEL_REGISTRY["ann"] = keras.models.load_model(MODEL_PATH_ANN)
        except OSError as exc:
            logger.warning("Could not load ANN %s: %s", MODEL_PATH_ANN, exc)
        except ValueError as exc:
            logger.warning("Invalid Keras model %s: %s", MODEL_PATH_ANN, exc)
    elif MODEL_PATH_ANN.exists() and not TENSORFLOW_AVAILABLE:
        logger.warning("ann_model.keras present but TensorFlow is not installed; ANN unavailable.")

    _fitted_preprocessor = None
    if PREPROCESSOR_PATH.exists():
        try:
            _fitted_preprocessor = joblib.load(PREPROCESSOR_PATH)
        except OSError as exc:
            logger.warning("Could not load preprocessor %s: %s", PREPROCESSOR_PATH, exc)

    if _fitted_preprocessor is None:
        for key in ("lr", "rf", "xgb"):
            pipe = MODEL_REGISTRY.get(key)
            if pipe is not None and hasattr(pipe, "named_steps"):
                pre = pipe.named_steps.get("preprocessor")
                if pre is not None:
                    _fitted_preprocessor = pre
                    break

    _attach_best_pipeline_fallback_lr()

    active_model_key = _resolve_default_active_key()


def _attach_best_pipeline_fallback_lr() -> None:
 
    if MODEL_REGISTRY["lr"] is None and PIPELINE_PATH.exists():
        try:
            MODEL_REGISTRY["lr"] = joblib.load(PIPELINE_PATH)
            logger.info("Using best_pipeline.joblib for registry key 'lr' (model_lr.joblib not found).")
        except OSError as exc:
            logger.warning("Could not load fallback pipeline %s: %s", PIPELINE_PATH, exc)


def _resolve_default_active_key() -> str:
    """Prefer ann, then xgb, rf, lr based on which registry entries loaded successfully."""
    for key in ("ann", "xgb", "rf", "lr"):
        if MODEL_REGISTRY.get(key) is not None:
            return key
    return "lr"


def _get_preprocessor() -> Any | None:
    """Return the fitted ColumnTransformer used with the ANN."""
    return _fitted_preprocessor


def _artifact_path_for_model(model_key: str) -> str:
    """Return a stable path string for the model artifact used in API responses."""
    mapping = {
        "lr": str(MODEL_PATH_LR.as_posix()),
        "rf": str(MODEL_PATH_RF.as_posix()),
        "xgb": str(MODEL_PATH_XGB.as_posix()),
        "ann": str(MODEL_PATH_ANN.as_posix()),
    }
    return mapping.get(model_key, str(PIPELINE_PATH.as_posix()))


def _predict_with_registered_model(
    model_key: str,
    feature_frame: pd.DataFrame,
) -> tuple[int, float | None, float | None, str]:
  
    model_obj = MODEL_REGISTRY.get(model_key)
    if model_obj is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{model_key}' is not loaded. Train and save artifacts first.",
        )

    path_str = _artifact_path_for_model(model_key)

    if model_key in {"lr", "rf", "xgb"}:
        pred = int(model_obj.predict(feature_frame)[0])
        proba: float | None = None
        confidence: float | None = None
        if hasattr(model_obj, "predict_proba"):
            proba = float(model_obj.predict_proba(feature_frame)[0][1])
            confidence = proba if pred == 1 else (1.0 - proba)
        return pred, proba, confidence, path_str

    if model_key == "ann":
        pre = _get_preprocessor()
        if pre is None:
            raise HTTPException(
                status_code=503,
                detail="Preprocessor not available for ANN. Run ml/preprocess.py training pipeline.",
            )
        xt = pre.transform(feature_frame)
        if hasattr(xt, "toarray"):
            xt = xt.toarray()
        raw_p = model_obj.predict(xt, verbose=0).reshape(-1)
        proba_ann = float(raw_p[0])
        pred = 1 if proba_ann >= 0.5 else 0
        confidence = proba_ann if pred == 1 else (1.0 - proba_ann)
        return pred, proba_ann, confidence, path_str

    raise HTTPException(status_code=400, detail=f"Unsupported model key: {model_key}")


def _list_known_plot_basenames() -> list[str]:
    """Return plot filenames without extension for error messages."""
    if not PLOTS_DIR.exists():
        return []
    names: list[str] = []
    for p in PLOTS_DIR.iterdir():
        if p.is_file() and p.suffix.lower() == ".png":
            names.append(p.stem)
    return sorted(names)


def _plots_folder_has_png() -> bool:
    """Return True if plots/ contains at least one PNG file."""
    if not PLOTS_DIR.exists():
        return False
    return any(p.suffix.lower() == ".png" for p in PLOTS_DIR.iterdir() if p.is_file())


def _safe_read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.warning("Invalid JSON in %s", path)
        return None
    except OSError as exc:
        logger.warning("Cannot read %s: %s", path, exc)
        return None


def _load_feature_info() -> dict[str, Any]:
    """
    Load optional per-feature UI metadata.
    Shape (by convention): { "<feature>": { title, units, description, dataset_source, effect_note } }
    """
    return _safe_read_json(FEATURE_INFO_PATH) or {}


def _data_mtime() -> float | None:
    try:
        return DATA_PATH.stat().st_mtime if DATA_PATH.exists() else None
    except OSError:
        return None


def _safe_float(x: Any) -> float | None:
    try:
        v = float(x)
        if math.isfinite(v):
            return v
        return None
    except (TypeError, ValueError):
        return None


def _build_explain_stats() -> dict[str, dict[str, Any]]:
    """
    Build lightweight per-feature statistics from the training dataset to support an
    interpretation-oriented "why this result" panel.

    This is NOT a formal model explanation. It's a dataset-informed heuristic that:
      - normalizes numeric values by IQR (robust scale),
      - estimates direction using correlation with the binary target (PDAC vs non-PDAC),
      - ranks features by magnitude of standardized deviation * |correlation|.
    """
    metadata = _safe_read_json(METADATA_PATH) or {}
    feature_columns = _feature_columns_from_metadata(metadata) or []
    if not feature_columns or not DATA_PATH.exists():
        return {}

    df = pd.read_csv(DATA_PATH)
    if "diagnosis" not in df.columns:
        return {}

    y = (df["diagnosis"] == 3).astype(int)
    stats: dict[str, dict[str, Any]] = {}

    for col in feature_columns:
        if col not in df.columns:
            continue

        s = df[col]
        if pd.api.types.is_numeric_dtype(s):
            x = pd.to_numeric(s, errors="coerce")
            mask = x.notna() & y.notna()
            x = x[mask]
            yy = y[mask]
            if x.empty:
                continue

            q1 = float(x.quantile(0.25))
            q3 = float(x.quantile(0.75))
            iqr = q3 - q1
            median = float(x.median())
            # Point-biserial correlation is Pearson correlation with binary y.
            corr = float(pd.Series(x).corr(pd.Series(yy))) if len(x) > 2 else 0.0
            if not math.isfinite(corr):
                corr = 0.0

            stats[col] = {
                "type": "number",
                "median": median,
                "q1": q1,
                "q3": q3,
                "iqr": float(iqr),
                "corr": corr,
            }
        else:
            cat = s.astype(str)
            mask = cat.notna() & y.notna()
            cat = cat[mask]
            yy = y[mask]
            rates: dict[str, float] = {}
            for v in sorted(cat.unique().tolist()):
                m = cat == v
                if int(m.sum()) < 5:
                    continue
                rates[str(v)] = float(yy[m].mean())
            if not rates:
                continue
            overall = float(yy.mean())
            stats[col] = {
                "type": "categorical",
                "rates": rates,
                "overall_rate": overall,
            }

    return stats


def _get_explain_stats() -> dict[str, dict[str, Any]]:
    global _explain_cache_key, _cached_explain_stats
    mtime = _data_mtime()
    if _cached_explain_stats is not None and mtime == _explain_cache_key:
        return _cached_explain_stats
    _cached_explain_stats = _build_explain_stats()
    _explain_cache_key = mtime
    return _cached_explain_stats


def _get_field_schema() -> list[dict[str, Any]]:
    global _schema_cache_key, _cached_field_schema
    try:
        key = (
            METADATA_PATH.stat().st_mtime if METADATA_PATH.exists() else None,
            DATA_PATH.stat().st_mtime if DATA_PATH.exists() else None,
        )
    except OSError:
        key = (None, None)
    if _cached_field_schema is not None and key == _schema_cache_key:
        return _cached_field_schema
    _cached_field_schema = _build_field_schema()
    _schema_cache_key = key
    return _cached_field_schema


def _load_pipeline() -> Any:
    if not PIPELINE_PATH.exists():
        raise FileNotFoundError(
            "Model pipeline not found. Train first to create "
            f"`{PIPELINE_PATH.as_posix()}` (run `python ml/train.py`)."
        )
    return joblib.load(PIPELINE_PATH)


def _feature_columns_from_metadata(metadata: dict[str, Any] | None) -> list[str] | None:
    if not metadata:
        return None
    cols = metadata.get("feature_columns")
    if isinstance(cols, list) and all(isinstance(c, str) for c in cols):
        return cols
    return None


def _list_plot_files() -> list[Path]:
    if not PLOTS_DIR.exists():
        return []
    return sorted([p for p in PLOTS_DIR.rglob("*") if p.is_file()])


def _plot_to_payload(path: Path) -> dict[str, Any]:
    rel = path.relative_to(PLOTS_DIR).as_posix()
    return {
        "filename": rel,
        "bytes": path.stat().st_size,
        "static_url": f"/static/plots/{rel}",
        "download_url": f"/plots/{rel}",
    }


def _human_label(pred: int) -> str:
    return "cancer_detected" if pred == 1 else "no_cancer_detected"


def _build_field_schema() -> list[dict[str, Any]]:
    metadata = _safe_read_json(METADATA_PATH) or {}
    feature_columns = _feature_columns_from_metadata(metadata) or []
    if not feature_columns:
        return []

    df = pd.read_csv(DATA_PATH) if DATA_PATH.exists() else pd.DataFrame()
    feature_info = _load_feature_info()
    fields: list[dict[str, Any]] = []

    for col in feature_columns:
        info = feature_info.get(col) if isinstance(feature_info, dict) else None
        info_obj = info if isinstance(info, dict) else {}
        display_label = str(info_obj.get("title") or col.replace("_", " ").title())
        if col in df.columns:
            series = df[col]
            if pd.api.types.is_numeric_dtype(series):
                clean = pd.to_numeric(series, errors="coerce").dropna()
                unique_vals = sorted(clean.unique().tolist())
                # For UI dropdowns: cap options to keep payload small.
                options: list[float] = []
                if 0 < len(unique_vals) <= 20:
                    options = [float(x) for x in unique_vals]
                elif len(unique_vals) > 20:
                    # Use quantiles as representative values.
                    qs = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]
                    options = [float(clean.quantile(q)) for q in qs]
                fields.append(
                    {
                        "name": col,
                        "label": display_label,
                        "type": "number",
                        "required": True,
                        "min": float(clean.min()) if not clean.empty else None,
                        "max": float(clean.max()) if not clean.empty else None,
                        "options": [round(x, 4) for x in options] if options else [],
                        "units": info_obj.get("units"),
                        "description": info_obj.get("description"),
                        "dataset_source": info_obj.get("dataset_source"),
                        "effect_note": info_obj.get("effect_note"),
                    }
                )
            else:
                options = [str(v) for v in sorted(series.dropna().astype(str).unique())][:20]
                fields.append(
                    {
                        "name": col,
                        "label": display_label,
                        "type": "categorical",
                        "required": True,
                        "options": options,
                        "units": info_obj.get("units"),
                        "description": info_obj.get("description"),
                        "dataset_source": info_obj.get("dataset_source"),
                        "effect_note": info_obj.get("effect_note"),
                    }
                )
        else:
            inferred_type = "categorical" if col.lower() in {"sex", "gender"} else "number"
            payload = {
                "name": col,
                "label": display_label,
                "type": inferred_type,
                "required": True,
                "units": info_obj.get("units"),
                "description": info_obj.get("description"),
                "dataset_source": info_obj.get("dataset_source"),
                "effect_note": info_obj.get("effect_note"),
            }
            if inferred_type == "categorical":
                payload["options"] = ["M", "F"] if col.lower() in {"sex", "gender"} else []
            fields.append(payload)

    return fields


def _extract_feature_importance(pipeline: Any) -> list[dict[str, Any]]:
    try:
        preprocessor = pipeline.named_steps.get("preprocessor")
        classifier = pipeline.named_steps.get("classifier")
        if preprocessor is None or classifier is None:
            return []
        if not hasattr(classifier, "feature_importances_"):
            return []
        feature_names = preprocessor.get_feature_names_out().tolist()
        importances = classifier.feature_importances_.tolist()
        pairs = [
            {"feature": str(name), "importance": float(value)}
            for name, value in zip(feature_names, importances)
        ]
        pairs.sort(key=lambda x: x["importance"], reverse=True)
        return pairs[:25]
    except (AttributeError, TypeError, ValueError) as exc:
        logger.debug("Feature importance unavailable: %s", exc)
        return []


def _fmt_metric(value: Any) -> str:
    try:
        if value is None:
            return "n/a"
        return f"{float(value):.3f}"
    except (TypeError, ValueError):
        return str(value)


def _fmt_confusion_matrix(cm: Any) -> list[str]:
    if not isinstance(cm, list) or len(cm) != 2:
        return ["n/a"]
    try:
        tn, fp = cm[0]
        fn, tp = cm[1]
        return [
            f"TN={tn}  FP={fp}",
            f"FN={fn}  TP={tp}",
        ]
    except (TypeError, ValueError, IndexError, KeyError):
        return ["n/a"]


def _derived_from_confusion_matrix(cm: Any) -> dict[str, float] | None:

    if not isinstance(cm, list) or len(cm) != 2:
        return None
    try:
        tn, fp = cm[0]
        fn, tp = cm[1]
        tn = float(tn); fp = float(fp); fn = float(fn); tp = float(tp)
        eps = 1e-12

        sensitivity = tp / (tp + fn + eps)  # recall, TPR
        specificity = tn / (tn + fp + eps)  # TNR
        fnr = fn / (fn + tp + eps)
        fpr = fp / (fp + tn + eps)
        npv = tn / (tn + fn + eps)
        ppv = tp / (tp + fp + eps)  # precision

        return {
            "sensitivity": float(sensitivity),
            "specificity": float(specificity),
            "fnr": float(fnr),
            "fpr": float(fpr),
            "npv": float(npv),
            "ppv": float(ppv),
        }
    except (TypeError, ValueError, ZeroDivisionError, IndexError, KeyError):
        return None


def _compact_report_lines(perf: dict[str, Any]) -> list[dict[str, Any]]:
    summary = perf.get("summary_metrics") or {}
    cm = perf.get("confusion_matrix")
    fi = perf.get("feature_importance") or []
    derived = _derived_from_confusion_matrix(cm) or {}

    blocks: list[dict[str, Any]] = []

    blocks.append(
        {
            "id": "summary",
            "title": "Summary",
            "style": "metrics",
            "lines": [
                f"Best model: {perf.get('best_model') or 'unknown'}",
                f"Accuracy: {_fmt_metric(summary.get('accuracy'))}",
                f"Precision: {_fmt_metric(summary.get('precision'))}",
                f"Recall: {_fmt_metric(summary.get('recall'))}",
                f"F1: {_fmt_metric(summary.get('f1_score'))}",
                f"ROC AUC: {_fmt_metric(summary.get('roc_auc'))}",
            ],
            "chips": [
                {"label": f"ACC {_fmt_metric(summary.get('accuracy'))}", "tone": "neutral"},
                {"label": f"SEN {_fmt_metric(summary.get('recall'))}", "tone": "neutral"},
                {"label": f"SPEC {_fmt_metric(derived.get('specificity'))}", "tone": "neutral"},
                {"label": f"AUC {_fmt_metric(summary.get('roc_auc'))}", "tone": "neutral"},
                {"label": f"FNR {_fmt_metric(derived.get('fnr'))}", "tone": "neutral"},
            ],
        }
    )

    blocks.append(
        {
            "id": "confusion_matrix",
            "title": "Confusion matrix",
            "style": "matrix",
            "lines": _fmt_confusion_matrix(cm),
        }
    )

    if fi:
        lines = [f"{x.get('feature')}: {float(x.get('importance', 0.0)):.4f}" for x in fi[:8]]
        blocks.append(
            {
                "id": "feature_importance",
                "title": "Top feature importance",
                "style": "list",
                "lines": lines,
            }
        )

    rec_plots = perf.get("recommended_plots") or {}
    plot_urls = [u for u in [rec_plots.get("roc_curve"), rec_plots.get("precision_recall_curve")] if u]
    if plot_urls:
        blocks.append(
            {
                "id": "recommended_plots",
                "title": "Recommended plots",
                "style": "links",
                "lines": plot_urls,
            }
        )

    blocks.append(
        {
            "id": "disclaimer",
            "title": "Note",
            "style": "note",
            "lines": [
                "These metrics are from a held-out test split used during training.",
                "Predictions are not a medical diagnosis.",
            ],
        }
    )

    return blocks


class PredictRequest(BaseModel):
    features: dict[str, Any] = Field(
        ...,
        description="Feature name -> value. Must provide all required features from /prediction/schema.",
        examples=[
            {
                "age": 64,
                "sex": "M",
                "creatinine": 1.0,
            }
        ],
    )
    model: str | None = Field(
        default=None,
        description="Optional model key: lr, rf, xgb, or ann. Defaults to the active model.",
    )


class PredictResponse(BaseModel):
    prediction: int = Field(..., description="0 = non-PDAC, 1 = PDAC")
    predicted_label: str = Field(..., description="Human-readable class label")
    probability: float | None = Field(
        None,
        description="If the model supports predict_proba, this is P(PDAC=1).",
        ge=0.0,
        le=1.0,
    )
    confidence: float | None = Field(
        None,
        description="Confidence of chosen class.",
        ge=0.0,
        le=1.0,
    )
    message: str
    model_path: str
    model_used: str = Field(..., description="Registry key of the model that produced the prediction.")
    model_name: str = Field(..., description="Human-readable model name.")


class ExplainItem(BaseModel):
    feature: str
    label: str
    direction: str = Field(..., description="Human-readable directionality statement.")
    strength: float = Field(..., description="Relative strength score for ranking (unitless).")
    details: str = Field(..., description="Short rationale string derived from dataset statistics.")


class ExplainResponse(BaseModel):
    note: str
    items: list[ExplainItem]


class SelectModelRequest(BaseModel):
    """Request body for setting the default model used by /predict when `model` is omitted."""

    model: str = Field(..., description="One of: lr, rf, xgb, ann")


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    """Initialize model registry before handling requests."""
    load_model_registry()
    yield


app = FastAPI(
    title="Pancreatic Cancer Risk API",
    description=(
        "FastAPI service for pancreatic cancer risk prediction.\n\n"
        "Docs: open `/docs` (Swagger UI) or `/redoc`."
    ),
    version="1.0.0",
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if PLOTS_DIR.exists():
    app.mount("/static/plots", StaticFiles(directory=str(PLOTS_DIR)), name="plots")


@app.get("/")
def root() -> dict[str, Any]:
    return {
        "service": "pancreatic-cancer-risk-api",
        "docs": "/docs",
        "redoc": "/redoc",
        "endpoints": [
            "/predict",
            "/prediction/schema",
            "/health",
            "/metadata",
            "/metrics",
            "/model/performance",
            "/model/performance/blocks",
            "/model/summary",
            "/select-model",
            "/active-model",
            "/models",
            "/graph/{graph_name}",
            "/features",
            "/plots",
            "/plots/{filename}",
            "/static/plots/{filename}",
        ],
    }


@app.get("/health")
def health() -> dict[str, Any]:
    models_loaded = {k: MODEL_REGISTRY.get(k) is not None for k in ("lr", "rf", "xgb", "ann")}
    return {
        "ok": True,
        "active_model": active_model_key,
        "models_loaded": models_loaded,
        "pipeline_present": PIPELINE_PATH.exists(),
        "plots_present": _plots_folder_has_png(),
        "version": "1.0",
        "metadata_present": METADATA_PATH.exists(),
        "metrics_present": METRICS_PATH.exists(),
        "feature_columns_in_metadata": bool(_feature_columns_from_metadata(_safe_read_json(METADATA_PATH))),
    }


@app.get("/metadata")
def metadata() -> dict[str, Any]:
    data = _safe_read_json(METADATA_PATH)
    if data is None:
        raise HTTPException(status_code=404, detail="metadata.json not found (train the model first).")
    return data


@app.get("/metrics")
def metrics() -> dict[str, Any]:
    data = _safe_read_json(METRICS_PATH)
    if data is None:
        raise HTTPException(status_code=404, detail="metrics.json not found (train the model first).")
    return data


@app.get("/prediction/schema")
def prediction_schema() -> dict[str, Any]:
    metadata = _safe_read_json(METADATA_PATH)
    cols = _feature_columns_from_metadata(metadata)
    if not cols:
        raise HTTPException(
            status_code=404,
            detail="Feature list not available. Train the model to generate models/metadata.json.",
        )
    fields = _get_field_schema()
    return {
        "target": {
            "positive_class": 1,
            "negative_class": 0,
            "positive_label": "cancer_detected",
            "negative_label": "no_cancer_detected",
            "definition": (metadata or {}).get("target_definition"),
        },
        "fields": fields,
        "required_fields": [f["name"] for f in fields if f.get("required")],
    }


@app.get("/features")
def features() -> dict[str, Any]:
    fields = _get_field_schema()
    cols = [f["name"] for f in fields]
    if not cols:
        raise HTTPException(
            status_code=404,
            detail="Feature list not available. Train the model to generate models/metadata.json.",
        )
    return {"feature_columns": cols, "count": len(cols), "fields": fields}


@app.get("/plots")
def list_plots() -> dict[str, Any]:
    files = _list_plot_files()
    if not files:
        return {"plots": [], "note": "plots/ folder not found yet. Run training/validation to generate plots."}
    payload = [_plot_to_payload(p) for p in files]
    return {"plots": payload, "count": len(payload)}


@app.get("/plots/{filename:path}")
def get_plot(filename: str) -> FileResponse:
    if not PLOTS_DIR.exists():
        raise HTTPException(status_code=404, detail="plots/ folder not found.")
    if ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")

    plots_root = PLOTS_DIR.resolve()
    try:
        resolved = (plots_root / filename).resolve()
        resolved.relative_to(plots_root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path.") from None

    path = resolved
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Plot not found.")

    media_type = "application/octet-stream"
    ext = path.suffix.lower()
    if ext in {".png"}:
        media_type = "image/png"
    elif ext in {".jpg", ".jpeg"}:
        media_type = "image/jpeg"
    elif ext in {".webp"}:
        media_type = "image/webp"

    return FileResponse(path=str(path), media_type=media_type, filename=path.name)


@app.get("/graph/{graph_name}")
def get_graph_by_name(graph_name: str) -> FileResponse:

    if ".." in graph_name or "/" in graph_name or "\\" in graph_name:
        raise HTTPException(status_code=400, detail="Invalid graph name.")

    if not PLOTS_DIR.exists():
        raise HTTPException(status_code=404, detail="plots/ folder not found.")

    path = (PLOTS_DIR / f"{graph_name}.png").resolve()
    try:
        path.relative_to(PLOTS_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid graph name.") from None

    if not path.is_file():
        available = _list_known_plot_basenames()
        raise HTTPException(
            status_code=404,
            detail=f"Graph '{graph_name}' not found. Available: {available}",
        )

    return FileResponse(path=str(path), media_type="image/png", filename=path.name)


@app.post("/select-model")
def select_model_endpoint(body: SelectModelRequest) -> dict[str, Any]:
    """Set the global default model for /predict when the request omits `model`."""
    global active_model_key

    key = body.model.strip().lower()
    valid = {"lr", "rf", "xgb", "ann"}
    if key not in valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model key. Valid options: {sorted(valid)}",
        )
    if MODEL_REGISTRY.get(key) is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{key}' is not available (artifact missing or failed to load).",
        )
    active_model_key = key
    meta = MODEL_METADATA[key]
    return {
        "message": "Active model updated successfully",
        "active_model": key,
        "model_full_name": meta["name"],
        "description": meta["description"],
    }


@app.get("/active-model")
def get_active_model() -> dict[str, Any]:
    """Return the current default model and whether it is loaded."""
    key = active_model_key
    meta = MODEL_METADATA.get(key, {"name": key, "description": ""})
    loaded = MODEL_REGISTRY.get(key) is not None
    return {
        "active_model": key,
        "model_full_name": meta["name"],
        "description": meta["description"],
        "loaded": loaded,
    }


@app.get("/models")
def list_models() -> dict[str, Any]:
    """
    List all model keys with metadata, load status, and which one is active
    (for mobile client dropdowns).
    """
    available: list[dict[str, Any]] = []
    for key in ("lr", "rf", "xgb", "ann"):
        meta = MODEL_METADATA[key]
        available.append(
            {
                "key": key,
                "name": meta["name"],
                "description": meta["description"],
                "active": key == active_model_key,
                "loaded": MODEL_REGISTRY.get(key) is not None,
            }
        )
    return {"available_models": available, "active_model": active_model_key}


@app.get("/model/performance")
def model_performance() -> dict[str, Any]:
    metadata = _safe_read_json(METADATA_PATH)
    metrics_data = _safe_read_json(METRICS_PATH)
    if not metadata or not metrics_data:
        raise HTTPException(
            status_code=404,
            detail="Model artifacts missing. Need models/metadata.json and models/metrics.json.",
        )

    best_model = metadata.get("best_model")
    if best_model not in metrics_data:
        best_model = next(iter(metrics_data.keys()))
    selected = metrics_data.get(best_model, {})

    plots = [_plot_to_payload(p) for p in _list_plot_files()]
    roc_plot = next((p["static_url"] for p in plots if "roc" in p["filename"].lower()), None)
    pr_plot = next((p["static_url"] for p in plots if "precision" in p["filename"].lower()), None)

    feature_importance: list[dict[str, Any]] = []
    try:
        pipeline = _load_pipeline()
        feature_importance = _extract_feature_importance(pipeline)
    except FileNotFoundError:
        feature_importance = []
    except OSError as exc:
        logger.warning("Could not load pipeline for feature importance: %s", exc)
        feature_importance = []

    cm = selected.get("confusion_matrix")
    derived = _derived_from_confusion_matrix(cm) or {}

    return {
        "target_definition": metadata.get("target_definition"),
        "best_model": best_model,
        "summary_metrics": {
            "accuracy": selected.get("accuracy"),
            "precision": selected.get("precision"),
            "recall": selected.get("recall"),
            "f1_score": selected.get("f1_score"),
            "roc_auc": selected.get("roc_auc"),
            "specificity": derived.get("specificity"),
            "sensitivity": derived.get("sensitivity"),
            "fnr": derived.get("fnr"),
            "fpr": derived.get("fpr"),
            "npv": derived.get("npv"),
        },
        "confusion_matrix": cm,
        "classification_report": selected.get("classification_report"),
        "feature_importance": feature_importance,
        "all_models": metrics_data,
        "plots": plots,
        "recommended_plots": {
            "roc_curve": roc_plot,
            "precision_recall_curve": pr_plot,
        },
    }


@app.get("/model/performance/blocks")
def model_performance_blocks() -> dict[str, Any]:
    perf = model_performance()
    return {
        "title": "Model Performance Dashboard",
        "best_model": perf.get("best_model"),
        "blocks": _compact_report_lines(perf),
        "plots": perf.get("plots", []),
    }


@app.get("/model/summary")
def model_summary() -> dict[str, Any]:
    perf = model_performance()
    summary = perf.get("summary_metrics") or {}
    return {
        "best_model": perf.get("best_model"),
        "target_definition": perf.get("target_definition"),
        "metrics": {
            "accuracy": summary.get("accuracy"),
            "precision": summary.get("precision"),
            "recall": summary.get("recall"),
            "f1_score": summary.get("f1_score"),
            "roc_auc": summary.get("roc_auc"),
            "specificity": summary.get("specificity"),
            "sensitivity": summary.get("sensitivity"),
            "fnr": summary.get("fnr"),
            "fpr": summary.get("fpr"),
            "npv": summary.get("npv"),
        },
    }

@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest = Body(...)) -> PredictResponse:
    schema_fields = _get_field_schema()
    feature_columns = [f["name"] for f in schema_fields]

    features_in = payload.features or {}
    if not isinstance(features_in, dict):
        raise HTTPException(status_code=422, detail="`features` must be an object/dictionary.")
    if not feature_columns:
        raise HTTPException(status_code=503, detail="Feature schema is unavailable. Re-train model artifacts.")

    unknown_fields = sorted([k for k in features_in.keys() if k not in feature_columns])
    if unknown_fields:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown feature(s): {unknown_fields}. Use /prediction/schema for exact input fields.",
        )

    converted: dict[str, Any] = {}
    missing: list[str] = []
    for field in schema_fields:
        name = field["name"]
        if name not in features_in:
            missing.append(name)
            continue

        value = features_in.get(name)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(name)
            continue

        if field.get("type") == "number":
            try:
                converted[name] = float(value)
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=422, detail=f"`{name}` must be numeric.") from exc

            min_v = field.get("min")
            max_v = field.get("max")
            if min_v is not None and converted[name] < float(min_v):
                raise HTTPException(status_code=422, detail=f"`{name}` must be >= {min_v}.")
            if max_v is not None and converted[name] > float(max_v):
                raise HTTPException(status_code=422, detail=f"`{name}` must be <= {max_v}.")
        else:
            converted[name] = str(value)
            options = field.get("options") or []
            if options and converted[name] not in options:
                raise HTTPException(
                    status_code=422,
                    detail=f"`{name}` must be one of {options}.",
                )

    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing required field(s): {sorted(missing)}.",
        )

    row = {c: converted[c] for c in feature_columns}
    df = pd.DataFrame([row], columns=feature_columns)

    model_key = payload.model.strip().lower() if payload.model else active_model_key
    valid = {"lr", "rf", "xgb", "ann"}
    if model_key not in valid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model key. Valid options: {sorted(valid)}",
        )
    if MODEL_REGISTRY.get(model_key) is None:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{model_key}' is not loaded. Available: {[k for k, v in MODEL_REGISTRY.items() if v]}",
        )

    meta = MODEL_METADATA[model_key]

    try:
        pred, proba, confidence, path_str = _predict_with_registered_model(model_key, df)
        label = _human_label(pred)
        return PredictResponse(
            prediction=pred,
            predicted_label=label,
            probability=proba,
            confidence=confidence,
            message=(
                "Model prediction: cancer detected." if pred == 1 else "Model prediction: no cancer detected."
            ),
            model_path=path_str,
            model_used=model_key,
            model_name=meta["name"],
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid feature values for prediction: {e}",
        ) from e
    except (OSError, TypeError) as e:
        logger.exception("Prediction failed")
        raise HTTPException(
            status_code=500,
            detail="Prediction failed due to a server error.",
        ) from e


@app.post("/explain", response_model=ExplainResponse)
def explain(payload: PredictRequest = Body(...)) -> ExplainResponse:

    schema_fields = _get_field_schema()
    feature_columns = [f["name"] for f in schema_fields]
    if not feature_columns:
        raise HTTPException(status_code=503, detail="Feature schema is unavailable. Re-train model artifacts.")

    # Reuse the same validation/conversion logic as /predict (duplicated for clarity/decoupling).
    features_in = payload.features or {}
    if not isinstance(features_in, dict):
        raise HTTPException(status_code=422, detail="`features` must be an object/dictionary.")

    unknown_fields = sorted([k for k in features_in.keys() if k not in feature_columns])
    if unknown_fields:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown feature(s): {unknown_fields}. Use /prediction/schema for exact input fields.",
        )

    converted: dict[str, Any] = {}
    missing: list[str] = []
    for field in schema_fields:
        name = field["name"]
        if name not in features_in:
            missing.append(name)
            continue
        value = features_in.get(name)
        if value is None or (isinstance(value, str) and not value.strip()):
            missing.append(name)
            continue
        if field.get("type") == "number":
            v = _safe_float(value)
            if v is None:
                raise HTTPException(status_code=422, detail=f"`{name}` must be numeric.")
            converted[name] = v
        else:
            converted[name] = str(value)

    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required field(s): {sorted(missing)}.")

    stats = _get_explain_stats()
    items: list[ExplainItem] = []

    label_by_name = {f["name"]: str(f.get("label") or f["name"]) for f in schema_fields}

    for name in feature_columns:
        st = stats.get(name)
        if not st:
            continue
        if st.get("type") == "number":
            x = _safe_float(converted.get(name))
            if x is None:
                continue
            median = float(st.get("median", 0.0))
            iqr = float(st.get("iqr", 0.0))
            corr = float(st.get("corr", 0.0))
            scale = iqr if iqr and iqr > 1e-12 else 1.0
            z = (x - median) / scale
            strength = float(abs(z) * abs(corr))
            if strength <= 0:
                continue
            direction = (
                "Higher tends to increase risk in the dataset"
                if corr > 0
                else "Higher tends to decrease risk in the dataset"
                if corr < 0
                else "Direction unclear in dataset"
            )
            details = f"Value {x:.4g} vs median {median:.4g}; deviation {z:.2f}×IQR; corr={corr:.2f}."
            items.append(
                ExplainItem(
                    feature=name,
                    label=label_by_name.get(name, name),
                    direction=direction,
                    strength=strength,
                    details=details,
                )
            )
        else:
            v = str(converted.get(name))
            rates = st.get("rates") if isinstance(st.get("rates"), dict) else {}
            overall = float(st.get("overall_rate", 0.0))
            r = rates.get(v)
            if r is None:
                continue
            delta = float(r - overall)
            strength = abs(delta)
            direction = (
                f"Category '{v}' is associated with higher PDAC rate in the dataset"
                if delta > 0
                else f"Category '{v}' is associated with lower PDAC rate in the dataset"
                if delta < 0
                else f"Category '{v}' matches the dataset average PDAC rate"
            )
            details = f"PDAC rate for '{v}' ≈ {r:.2f} vs overall {overall:.2f} (Δ={delta:+.2f})."
            items.append(
                ExplainItem(
                    feature=name,
                    label=label_by_name.get(name, name),
                    direction=direction,
                    strength=float(strength),
                    details=details,
                )
            )

    items.sort(key=lambda x: x.strength, reverse=True)
    top = items[:3]

    return ExplainResponse(
        note=(
            "These highlights are dataset-informed heuristics (not formal model interpretability and not medical advice). "
            "They compare your inputs to the training dataset distribution and simple associations with the target."
        ),
        items=top,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
