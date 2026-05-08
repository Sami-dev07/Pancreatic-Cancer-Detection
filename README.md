# Pancreatic Cancer AI System

This project is an end-to-end system for pancreatic cancer (PDAC) risk prediction, demonstrating a full-stack AI workflow. It includes a Python ML pipeline (scikit-learn, Keras) for training, a FastAPI backend for serving models, and a Web/Android app  for user interaction. The application predicts PDAC risk from patient data and visualizes model performance through a comprehensive dashboard, highlighting key metrics for clinical risk assessment.

End-to-end project for pancreatic cancer risk modeling and mobile App:

- ML training pipeline (`ml/`)
- FastAPI backend (`api/`)
- Android app in Kotlin (`android-app/`)

## Repositories

- **Android app**: [Android-Pancreatic-Cancer](https://github.com/Sami-dev07/Android-Pancreatic-Cancer)
- **Backend API**: [Pancreatic-Cancer-Detection](https://github.com/Sami-dev07/Pancreatic-Cancer-Detection)

---

## Project Structure

```text
.
├── api/                 # FastAPI service
├── android-app/         # Android Studio project (Kotlin)
├── web/                 # Web app (React/Vite) mirroring Android UI
├── data/                # Input datasets
├── ml/                  # Training / preprocessing scripts
├── models/              # Trained artifacts and metrics outputs
├── plots/               # Evaluation plots used by API and app
├── requirements.txt
└── README.md
```

---

## Quick Start (Local)

### 1) Python environment

```cmd
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2) Train model and generate artifacts

```cmd
python ml/train.py
```

### 3) Run API

```cmd
python api/main.py
```

Swagger docs: `http://127.0.0.1:8000/docs`

### 3b) Run Web app (VS Code / Vite)

The web app mirrors the Android screens (Features → Predict, Metrics, Plots).

```cmd
cd web
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

### 4) Run Android app

- Open `android-app/` in Android Studio
- Sync Gradle
- Set `API_BASE_URL` in `android-app/app/build.gradle.kts`
- Run on device/emulator

---

## Core Flows

### 1) Custom Patient Prediction

- Android fetches schema from `GET /prediction/schema`
- User fills form generated from schema
- Android sends payload to `POST /predict`
- API returns class + probability + confidence + message

### 2) Model Performance Dashboard

- Android fetches compact blocks from `GET /model/performance/blocks`
- Android fetches metrics summary from `GET /model/summary`
- Plot images are loaded via `/static/plots/...`

---

## API Highlights

- `GET /prediction/schema` — strict model input schema (type/options/ranges)
- `POST /predict` — cancer vs no-cancer prediction
- `GET /model/summary` — accuracy, precision, sensitivity, specificity, F1, ROC-AUC, FNR/NPV
- `GET /model/performance` — full detailed performance payload
- `GET /model/performance/blocks` — Android-ready compact dashboard blocks
- `GET /plots` and `GET /static/plots/{filename}` — plots listing and serving
