# Pancreatic Cancer API (FastAPI)

FastAPI backend that serves a **trained pancreatic cancer (PDAC) risk model** with a strict, schema-driven prediction contract and a model evaluation dashboard (metrics + plots) designed for mobile consumption.

## Repository links

- Android app: [Android-Pancreatic-Cancer](https://github.com/Sami-dev07/Android-Pancreatic-Cancer-Detection)
- Backend API: [Pancreatic-Cancer-Detection](https://github.com/Sami-dev07/Pancreatic-Cancer-Detection)

---

## Features

- Strict schema-driven prediction (`/prediction/schema` + `/predict`)
- Cancer/no-cancer labeling aligned to training target
- Detailed model evaluation endpoints (metrics, confusion matrix, report, feature importance)
- Android-friendly compact dashboard payloads
- Plot/image serving for app dashboards

---

## Tech Stack

- Python
- FastAPI
- Pydantic
- pandas
- scikit-learn / XGBoost pipeline artifacts via `joblib`

---

## Run Locally

From the project root (one level above `api/`):

```cmd
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python ml/train.py
python api/main.py
```

Docs:

- Swagger: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`

For phone access:

```cmd
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload --app-dir .
```

---

## Prediction Semantics

Training target is:

- `1 = PDAC (cancer)`
- `0 = non-PDAC (no cancer)`

API response includes:

- `prediction` (0/1)
- `predicted_label` (`cancer_detected` / `no_cancer_detected`)
- `probability` (P(cancer))
- `confidence`
- human-readable `message`

---

## Clinical interpretation (why FN matters)

For cancer-risk models, **false negatives** (missed cancers) are often the most critical failure mode.
That’s why this API exposes not only accuracy/AUC, but also:

- **Sensitivity (Recall / TPR)**: \(TP / (TP + FN)\) — how many cancers are detected
- **Specificity (TNR)**: \(TN / (TN + FP)\) — how many non-cancers are correctly ruled out
- **FNR (False Negative Rate)**: \(FN / (FN + TP)\) — missed-cancer rate (lower is better)
- **NPV**: \(TN / (TN + FN)\) — when the model says “no cancer”, how often it’s correct

Use these together with the confusion matrix to understand tradeoffs. This API output is **not a medical diagnosis**.

---

## Endpoints

### Health and metadata

- `GET /health`
- `GET /metadata`
- `GET /metrics`

### Schema and prediction

- `GET /prediction/schema`
- `GET /features`
- `POST /predict`

### Model performance

- `GET /model/summary` (accuracy, precision, sensitivity/recall, specificity, F1, ROC-AUC, FNR/FPR/NPV)
- `GET /model/performance` (full payload)
- `GET /model/performance/blocks` (compact Android-ready blocks)

### Plots and images

- `GET /plots`
- `GET /plots/{filename:path}`
- `GET /static/plots/{filename:path}`

---

## Example: Prediction Request

1) Get schema:

```http
GET /prediction/schema
```

2) Use exact fields from schema in request:

```json
{
  "features": {
    "age": 64,
    "sex": "M",
    "plasma_CA19_9": 100.0,
    "creatinine": 1.0,
    "LYVE1": 2.0,
    "REG1B": 20.0,
    "TFF1": 100.0,
    "REG1A": 10.0
  }
}
```

3) Typical response:

```json
{
  "prediction": 1,
  "predicted_label": "cancer_detected",
  "probability": 0.94,
  "confidence": 0.94,
  "message": "Model prediction: cancer detected.",
  "model_path": "..."
}
```

---

## Common Errors

- `422 Missing required field(s)`  
  Request does not include all schema fields.

- `422 Unknown feature(s)`  
  Request contains fields not used in training.

- `503 Model pipeline not found`  
  Run `python ml/train.py` first.


