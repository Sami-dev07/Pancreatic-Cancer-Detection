export type SchemaField = {
  name: string;
  label: string;
  type: "number" | "categorical" | string;
  required?: boolean;
  options?: Array<string | number> | null;
  min?: number | null;
  max?: number | null;
};

export type PredictionSchemaResponse = {
  fields: SchemaField[];
  required_fields?: string[];
  target?: Record<string, unknown> | null;
};

export type PredictResponse = {
  prediction: number;
  predicted_label: string;
  probability: number | null;
  confidence: number | null;
  message: string;
  model_path: string;
};

export type ModelSummaryResponse = {
  best_model: string | null;
  target_definition: string | null;
  metrics: Record<string, number | null>;
};

export type PlotItem = {
  filename: string;
  bytes: number;
  static_url: string;
  download_url: string;
};

export type ModelPerformanceBlocksResponse = {
  title: string;
  best_model: string | null;
  blocks: Array<{
    id: string;
    title: string;
    style?: string | null;
    lines?: string[];
    chips?: Array<{ label: string; tone?: string | null }> | null;
  }>;
  plots: PlotItem[];
};

function getApiBaseUrl(): string {
  const raw = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function withBase(path: string): string {
  const base = getApiBaseUrl();
  if (!base) return path; // dev: use Vite proxy + same-origin paths
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  const resp = await fetch(withBase(path));
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || `${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(withBase(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(text || `${resp.status} ${resp.statusText}`);
  }
  return (await resp.json()) as T;
}

