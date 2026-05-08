import type { PredictResponseBody, PredictionHistoryEntry, HistoryStats } from "../types/prediction";

const STORAGE_KEY = "pdac_risk_prediction_history_v1";

function safeParse(raw: string | null): PredictionHistoryEntry[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(isValidEntry);
  } catch {
    return [];
  }
}

function isValidEntry(x: unknown): x is PredictionHistoryEntry {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.createdAt === "string" &&
    o.features !== null &&
    typeof o.features === "object" &&
    o.result !== null &&
    typeof o.result === "object"
  );
}

/** Load all prediction history entries (newest first). */
export function loadPredictionHistory(): PredictionHistoryEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

/** Persist full list (newest first). */
export function savePredictionHistory(entries: PredictionHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

/** Append a successful prediction and return the new entry (newest first). */
export function appendPrediction(
  features: PredictionHistoryEntry["features"],
  result: PredictResponseBody,
): PredictionHistoryEntry {
  const entry: PredictionHistoryEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    features,
    result,
  };
  const next = [entry, ...loadPredictionHistory()];
  savePredictionHistory(next);
  return entry;
}

export function getHistoryEntryById(id: string): PredictionHistoryEntry | undefined {
  return loadPredictionHistory().find((e) => e.id === id);
}

/** Dashboard aggregates from stored history. */
export function computeHistoryStats(history: PredictionHistoryEntry[]): HistoryStats {
  if (history.length === 0) {
    return { total: 0, highRisk: 0, lowRisk: 0, averageProbability: null, latest: null };
  }
  const highRisk = history.filter((h) => h.result.prediction === 1).length;
  const lowRisk = history.filter((h) => h.result.prediction === 0).length;
  const probs = history
    .map((h) => h.result.probability)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const averageProbability =
    probs.length > 0 ? probs.reduce((a, b) => a + b, 0) / probs.length : null;
  return {
    total: history.length,
    highRisk,
    lowRisk,
    averageProbability,
    latest: history[0] ?? null,
  };
}
