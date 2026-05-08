# Pancreatic Cancer Risk — Web Client

Production-style **React + Vite + TypeScript + Tailwind** frontend for the Pancreatic Cancer Risk Prediction system. It mirrors the Android app flow: collect clinical inputs, call your existing **FastAPI** `POST /predict`, and display results clearly.

## Prerequisites

- Node.js **18+** (20 LTS recommended)
- A running FastAPI backend (see repo root `api/main.py`) with CORS enabled (your API already allows `*`)

## Setup

```bash
cd web
npm install
```

Create `.env` from the example:

```bash
copy .env.example .env   # Windows
# or: cp .env.example .env
```

Set your API base URL (include scheme; trailing slash optional):

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/
```

If `VITE_API_BASE_URL` is **empty**, the app uses a **mock prediction in development only**. In **production builds**, an empty URL causes submit to fail with a clear configuration error.

## Scripts

| Command         | Description                |
|-----------------|----------------------------|
| `npm run dev`   | Vite dev server (hot reload) |
| `npm run build` | Typecheck + production bundle |
| `npm run preview` | Serve the `dist/` folder locally |

```bash
npm run dev
# open http://127.0.0.1:5173
```

## Features (web dashboard)

- **Routes:** `/` (home), `/dashboard` (stats + Recharts), `/predict` (form), `/result/:id` (detail, PDF), `/history` (table), `/about`.
- **Persistence:** each successful prediction is stored in `localStorage` (this browser only).
- **API status:** header pill polls **GET** `{VITE_API_BASE_URL}/health`.
- **Exports:** result PDF via jsPDF (`utils/pdfExport.ts`).

## API contract

- **POST** `{VITE_API_BASE_URL}/predict`
- **GET** `{VITE_API_BASE_URL}/health` (optional; used for the status indicator)
- **Body:** `{ "features": { "age", "sex", "plasma_CA19_9", "creatinine", "LYVE1", "REG1B", "TFF1" }, "model": null | "lr" | "rf" | "xgb" | "ann" }`

Field names match your trained pipeline schema.

## Deployment

### Vercel

1. Push the repo (or connect the `web` folder as a monorepo subfolder: set **Root Directory** to `web`).
2. Framework preset: **Vite**.
3. Build command: `npm run build`, output: `dist`.
4. Environment variable: `VITE_API_BASE_URL` = your public API URL (e.g. `https://api.yourdomain.com/`).

### Netlify

1. New site from Git; base directory `web`.
2. Build: `npm run build`, publish: `web/dist`.
3. Site settings → Environment → add `VITE_API_BASE_URL`.

### Custom domain

Point DNS to Vercel/Netlify or your static host. Ensure the FastAPI server allows browser origins (your API uses permissive CORS; tighten for production if needed).

## Security note

This UI is for **research / education**. Always show the in-app disclaimer; do not present outputs as a diagnosis.


