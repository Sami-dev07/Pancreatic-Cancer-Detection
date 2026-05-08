import axios, { AxiosError } from "axios";
import type { PredictRequestBody, PredictResponseBody } from "../types/prediction";

const REQUEST_TIMEOUT_MS = 90_000;

function normalizeBaseUrl(url: string): string {
  const t = url.trim();
  return t.endsWith("/") ? t.slice(0, -1) : t;
}

/** Returns normalized base URL or null if unset. */
export function getApiBaseUrl(): string | null {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  return raw ? normalizeBaseUrl(raw) : null;
}

/** Minimal shape of GET /health used by the status indicator. */
export interface HealthResponse {
  ok?: boolean;
  active_model?: string;
  models_loaded?: Record<string, boolean>;
}

/**
 * Calls GET /health on the configured API. Returns null when no base URL is set.
 */
export async function fetchHealth(): Promise<HealthResponse | null> {
  const base = getApiBaseUrl();
  if (!base) return null;
  try {
    const { data } = await axios.get<HealthResponse>(`${base}/health`, { timeout: 12_000 });
    return data;
  } catch {
    return { ok: false };
  }
}

// ── Android parity endpoints (schema/models/plots/metrics) ─────────────────────

export type ModelKey = "lr" | "rf" | "xgb" | "ann";

export interface SchemaField {
  name: string;
  label: string;
  type: "number" | "string";
  required?: boolean;
  options?: string[] | null;
  min?: number | null;
  max?: number | null;
}

export interface PredictionSchemaResponse {
  target?: {
    positive_class: number;
    negative_class: number;
    positive_label: string;
    negative_label: string;
    definition?: string | null;
  };
  fields: SchemaField[];
  required_fields?: string[];
}

export interface ActiveModelResponse {
  active_model: ModelKey;
  model_full_name: string;
  description: string;
  loaded: boolean;
}

export interface ModelInfo {
  key: ModelKey;
  name: string;
  description: string;
  active: boolean;
  loaded: boolean;
}

export interface ModelsListResponse {
  available_models: ModelInfo[];
  active_model: ModelKey;
}

export interface SelectModelRequestBody {
  model: ModelKey;
}

export interface SelectModelResponseBody {
  message: string;
  active_model: ModelKey;
  model_full_name: string;
  description: string;
}

export interface ModelSummaryResponse {
  best_model?: string | null;
  target_definition?: string | null;
  metrics: Record<string, number | null>;
}

export interface PlotItem {
  filename: string;
  bytes: number;
  static_url: string;
  download_url: string;
}

export interface PlotsResponse {
  plots: PlotItem[];
  count?: number;
  note?: string;
}

function requireApiBaseUrl(): string {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error(
      "VITE_API_BASE_URL is not configured. Set it to your FastAPI server base URL.",
    );
  }
  return base;
}

export function resolveApiUrl(path: string): string {
  const base = requireApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export async function fetchPredictionSchema(): Promise<PredictionSchemaResponse> {
  const url = resolveApiUrl("/prediction/schema");
  const { data } = await axios.get<PredictionSchemaResponse>(url, { timeout: 20_000 });
  return data;
}

export async function fetchModels(): Promise<ModelsListResponse> {
  const url = resolveApiUrl("/models");
  const { data } = await axios.get<ModelsListResponse>(url, { timeout: 20_000 });
  return data;
}

export async function fetchActiveModel(): Promise<ActiveModelResponse> {
  const url = resolveApiUrl("/active-model");
  const { data } = await axios.get<ActiveModelResponse>(url, { timeout: 20_000 });
  return data;
}

export async function selectActiveModel(model: ModelKey): Promise<SelectModelResponseBody> {
  const url = resolveApiUrl("/select-model");
  const { data } = await axios.post<SelectModelResponseBody>(
    url,
    { model } satisfies SelectModelRequestBody,
    { timeout: 20_000, headers: { "Content-Type": "application/json" } },
  );
  return data;
}

export async function fetchModelSummary(): Promise<ModelSummaryResponse> {
  const url = resolveApiUrl("/model/summary");
  const { data } = await axios.get<ModelSummaryResponse>(url, { timeout: 20_000 });
  return data;
}

export async function fetchPlots(): Promise<PlotsResponse> {
  const url = resolveApiUrl("/plots");
  const { data } = await axios.get<PlotsResponse>(url, { timeout: 30_000 });
  return data;
}

/** Maps validated form values to API feature keys (matches backend /prediction/schema). */
export function formValuesToFeatures(
  values: import("../types/prediction").PredictionFormValues,
): Record<string, string | number> {
  return {
    age: values.age,
    sex: values.sex,
    plasma_CA19_9: values.plasma_CA19_9,
    creatinine: values.creatinine,
    LYVE1: values.LYVE1,
    REG1B: values.REG1B,
    TFF1: values.TFF1,
  };
}

function mockPredictResponse(features: Record<string, string | number>): PredictResponseBody {
  const age = Number(features.age);
  const pseudo = (age % 17) / 17 + (Number(features.plasma_CA19_9) % 100) / 500;
  const prob = Math.min(0.92, Math.max(0.08, pseudo));
  const prediction = prob >= 0.45 ? 1 : 0;
  return {
    prediction,
    predicted_label: prediction === 1 ? "cancer_detected" : "no_cancer_detected",
    probability: prob,
    confidence: prediction === 1 ? prob : 1 - prob,
    message:
      prediction === 1
        ? "[MOCK] Model prediction: cancer detected. Connect VITE_API_BASE_URL for live API."
        : "[MOCK] Model prediction: no cancer detected. Connect VITE_API_BASE_URL for live API.",
    model_path: "mock://local",
    model_used: "mock",
    model_name: "Mock (no backend)",
  };
}

/**
 * Calls FastAPI POST /predict. If VITE_API_BASE_URL is unset, returns a mock (dev only).
 */
export async function predictRisk(body: PredictRequestBody): Promise<PredictResponseBody> {
  const base = getApiBaseUrl();

  if (!base) {
    if (import.meta.env.PROD) {
      throw new Error(
        "VITE_API_BASE_URL is not configured. Set it in your hosting provider environment variables.",
      );
    }
    console.warn(
      "[api] VITE_API_BASE_URL is empty — using mock prediction. Set .env for real FastAPI calls.",
    );
    await new Promise((r) => setTimeout(r, 400));
    return mockPredictResponse(body.features);
  }

  const url = `${base}/predict`;

  try {
    const { data } = await axios.post<PredictResponseBody>(url, body, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
    return data;
  } catch (err) {
    throw normalizeAxiosError(err);
  }
}

/** User-facing string for UI alerts. */
export function normalizeAxiosError(err: unknown): Error {
  if (!axios.isAxiosError(err)) {
    return err instanceof Error ? err : new Error("Network error");
  }
  const ax = err as AxiosError<{ detail?: string | unknown }>;
  if (ax.code === "ECONNABORTED") {
    return new Error("Request timed out. Check your connection and try again.");
  }
  if (ax.response?.status === 503) {
    const d = ax.response.data?.detail;
    return new Error(typeof d === "string" ? d : "Service unavailable. Is the API running and trained?");
  }
  if (ax.response?.status === 422) {
    const d = ax.response.data?.detail;
    if (typeof d === "string") return new Error(d);
    if (Array.isArray(d)) {
      const msg = d
        .map((item: { msg?: string; loc?: unknown }) =>
          typeof item?.msg === "string" ? item.msg : JSON.stringify(item),
        )
        .join("; ");
      return new Error(msg || "Invalid input. Please check all fields.");
    }
    return new Error("Invalid input. Please check all fields.");
  }
  if (ax.response?.status === 400 || ax.response?.status === 404) {
    const d = ax.response.data?.detail;
    return new Error(typeof d === "string" ? d : "Bad request.");
  }
  if (!ax.response) {
    return new Error("Cannot reach the server. Check VITE_API_BASE_URL and CORS.");
  }
  const d = ax.response.data?.detail;
  return new Error(typeof d === "string" ? d : `Server error (${ax.response.status})`);
}
