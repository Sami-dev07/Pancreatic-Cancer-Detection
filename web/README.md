# Web App (VS Code launch)

This is a web version of the Android app screens:

- **Home**
- **Features (Predict)** → `GET /prediction/schema` + `POST /predict`
- **Metrics** → `GET /model/summary`
- **Plots** → `GET /model/performance/blocks` + images via `/static/plots/...`

## Run from VS Code

### 1) Start the API (FastAPI)

From repo root:

```cmd
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python ml/train.py
python api/main.py
```

### 2) Start the web app (Vite)

In a new terminal:

```cmd
cd web
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Notes

- The Vite dev server proxies API calls to `http://127.0.0.1:8000` (see `web/vite.config.ts`).
- If you get a `503 Model pipeline not found`, run `python ml/train.py` first.

## Deploy (domain)

In development, the web app calls relative paths like `/predict` and uses the Vite proxy.
In production, set `VITE_API_BASE_URL` so the frontend calls your deployed API:

1) Copy env file:

```cmd
copy .env.example .env
```

2) Set:

- `VITE_API_BASE_URL=https://<your-api-host>`

3) Build:

```cmd
npm run build
```

Deploy the generated `dist/` folder to your hosting provider (Vercel/Netlify/etc).

