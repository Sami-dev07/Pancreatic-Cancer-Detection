/** Request body for POST /predict (FastAPI). */
export interface PredictRequestBody {
  features: Record<string, string | number>;
  model?: string | null;
}

/** Response from POST /predict. */
export interface PredictResponseBody {
  prediction: number;
  predicted_label: string;
  probability: number | null;
  confidence: number | null;
  message: string;
  model_path: string;
  model_used: string;
  model_name: string;
}

/** Form shape before mapping to API feature keys. */
export interface PredictionFormValues {
  age: number;
  sex: "M" | "F";
  plasma_CA19_9: number;
  creatinine: number;
  LYVE1: number;
  REG1B: number;
  TFF1: number;
  model?: "" | "lr" | "rf" | "xgb" | "ann";
}

/** Snapshot of inputs + API response stored in localStorage. */
export interface PredictionHistoryEntry {
  id: string;
  createdAt: string;
  features: {
    age: number;
    sex: string;
    plasma_CA19_9: number;
    creatinine: number;
    LYVE1: number;
    REG1B: number;
    TFF1: number;
  };
  result: PredictResponseBody;
}

/** Aggregates for dashboard cards. */
export interface HistoryStats {
  total: number;
  highRisk: number;
  lowRisk: number;
  averageProbability: number | null;
  latest: PredictionHistoryEntry | null;
}
