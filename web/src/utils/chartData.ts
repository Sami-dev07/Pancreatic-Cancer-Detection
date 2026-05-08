import type { PredictionHistoryEntry } from "../types/prediction";

export const BIOMARKER_KEYS = [
  "plasma_CA19_9",
  "creatinine",
  "LYVE1",
  "REG1B",
  "TFF1",
] as const;

export type BiomarkerKey = (typeof BIOMARKER_KEYS)[number];

const LABELS: Record<BiomarkerKey, string> = {
  plasma_CA19_9: "CA19-9",
  creatinine: "Creatinine",
  LYVE1: "LYVE1",
  REG1B: "REG1B",
  TFF1: "TFF1",
};

export function biomarkerLabel(key: BiomarkerKey): string {
  return LABELS[key];
}

/** Per-biomarker maxima across history (minimum 1 to avoid divide-by-zero). */
export function biomarkerMaxima(history: PredictionHistoryEntry[]): Record<BiomarkerKey, number> {
  const m: Record<BiomarkerKey, number> = {
    plasma_CA19_9: 1,
    creatinine: 1,
    LYVE1: 1,
    REG1B: 1,
    TFF1: 1,
  };
  for (const e of history) {
    for (const k of BIOMARKER_KEYS) {
      const v = e.features[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        m[k] = Math.max(m[k], v);
      }
    }
  }
  return m;
}

/** Radar rows: each biomarker scaled 0–100 vs maxima from history. */
export function radarRowsForEntry(
  entry: PredictionHistoryEntry,
  maxima: Record<BiomarkerKey, number>,
): { name: string; value: number; fullMark: number }[] {
  return BIOMARKER_KEYS.map((k) => {
    const raw = entry.features[k];
    const denom = Math.max(maxima[k], 1e-9);
    const value = typeof raw === "number" && Number.isFinite(raw) ? Math.min(100, (raw / denom) * 100) : 0;
    return { name: LABELS[k], value, fullMark: 100 };
  });
}

export function barRowsForFeatures(features: PredictionHistoryEntry["features"]) {
  return BIOMARKER_KEYS.map((k) => ({
    name: LABELS[k],
    value: features[k],
  }));
}
