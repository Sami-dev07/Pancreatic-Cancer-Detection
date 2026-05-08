import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Disclaimer } from "../components/Disclaimer";
import { appendPrediction } from "../utils/storage";
import {
  fetchPredictionSchema,
  predictRisk,
  type ModelKey,
  type PredictionSchemaResponse,
  type SchemaField,
} from "../services/api";

/**
 * Android-like prediction workflow: load /prediction/schema, render dynamic form, call /predict.
 */
export function Predict() {
  const navigate = useNavigate();
  const [schema, setSchema] = useState<PredictionSchemaResponse | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);

  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [model, setModel] = useState<"" | ModelKey>("");
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const s = await fetchPredictionSchema();
        if (!alive) return;
        setSchema(s);
        const initial: Record<string, string> = {};
        for (const f of s.fields ?? []) {
          initial[f.name] = "";
        }
        setValues(initial);
      } catch (e) {
        if (!alive) return;
        setSchemaError(e instanceof Error ? e.message : "Failed to load /prediction/schema.");
      } finally {
        if (alive) setSchemaLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const required = useMemo(() => {
    const fields = schema?.fields ?? [];
    return fields.filter((f) => f.required !== false).map((f) => f.name);
  }, [schema]);

  const fields = schema?.fields ?? [];

  function setField(name: string, next: string) {
    setValues((v) => ({ ...v, [name]: next }));
  }

  function validateAndBuildFeatures(fields: SchemaField[]) {
    const out: Record<string, string | number> = {};
    const missing: string[] = [];

    for (const f of fields) {
      const raw = (values[f.name] ?? "").trim();
      const isReq = f.required !== false;
      if (isReq && raw.length === 0) {
        missing.push(f.label || f.name);
        continue;
      }
      if (!isReq && raw.length === 0) continue;

      if (f.type === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(`Field '${f.label}' must be numeric.`);
        if (f.min != null && n < f.min) throw new Error(`Field '${f.label}' must be >= ${f.min}.`);
        if (f.max != null && n > f.max) throw new Error(`Field '${f.label}' must be <= ${f.max}.`);
        out[f.name] = n;
      } else {
        if (Array.isArray(f.options) && f.options.length > 0 && !f.options.includes(raw)) {
          throw new Error(`Field '${f.label}' must be one of: ${f.options.join(", ")}.`);
        }
        out[f.name] = raw;
      }
    }

    if (missing.length) {
      throw new Error(`Missing required fields: ${missing.join(", ")}`);
    }
    return out;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!schema) return;
    setSubmitting(true);
    try {
      const features = validateAndBuildFeatures(schema.fields ?? []);
      const res = await predictRisk({ features, model: model === "" ? null : model });

      // Only persist known biomarkers if present (keeps existing history type stable)
      const stored = {
        age: Number(features.age),
        sex: String(features.sex),
        plasma_CA19_9: Number(features.plasma_CA19_9),
        creatinine: Number(features.creatinine),
        LYVE1: Number(features.LYVE1),
        REG1B: Number(features.REG1B),
        TFF1: Number(features.TFF1),
      };

      const entry = appendPrediction(stored, res);
      navigate(`/result/${entry.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Prediction failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="text-center sm:text-left">
        <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl">
          Custom Patient Prediction
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Complete all fields. Values are sent as JSON to your API&apos;s{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">POST /predict</code> endpoint. Each successful
          response is saved in this browser and opens the detailed result view.
        </p>
      </div>

      <div className="mt-8">
        <Disclaimer compact />
      </div>

      <div className="mt-8 space-y-6">
        {schemaLoading && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card">Loading /prediction/schema…</div>
        )}
        {schemaError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            {schemaError}
          </div>
        )}

        {schema && (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2 rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Model for this prediction (optional)
                </p>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value as "" | ModelKey)}
                  className="mt-2 w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="">Use Active Model</option>
                  <option value="lr">Logistic Regression</option>
                  <option value="rf">Random Forest</option>
                  <option value="xgb">XGBoost</option>
                  <option value="ann">ANN</option>
                </select>
              </div>

              {fields.map((f) => {
                const isReq = f.required !== false;
                const common =
                  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
                return (
                  <div
                    key={f.name}
                    className={`rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3 ${
                      f.name === "TFF1" ? "sm:col-span-2" : ""
                    }`}
                  >
                    <label className="text-sm font-medium text-slate-700">
                      {f.label} {isReq ? <span className="text-rose-600">*</span> : null}
                    </label>
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-mono">{f.name}</span>
                      {f.type === "number" && (f.min != null || f.max != null) && (
                        <span>
                          {" "}
                          · Range: {f.min ?? "—"} to {f.max ?? "—"}
                        </span>
                      )}
                    </p>

                    {Array.isArray(f.options) && f.options.length > 0 ? (
                      <select
                        value={values[f.name] ?? ""}
                        onChange={(e) => setField(f.name, e.target.value)}
                        className={`${common} mt-2`}
                      >
                        <option value="">Select…</option>
                        {f.options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={values[f.name] ?? ""}
                        onChange={(e) => setField(f.name, e.target.value)}
                        className={`${common} mt-2`}
                        inputMode={f.type === "number" ? "decimal" : "text"}
                        type={f.type === "number" ? "number" : "text"}
                        step={f.type === "number" ? "any" : undefined}
                        placeholder={f.type === "number" ? "Enter numeric value" : "Enter value"}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {formError && (
              <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {formError}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[44px] min-w-[200px] items-center justify-center rounded-xl bg-gradient-to-r from-clinical-600 to-clinical-700 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:from-clinical-700 hover:to-clinical-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Calling /predict..." : "Predict"}
              </button>
              <p className="text-xs text-slate-500">
                Required fields: {required.length}. Server will validate and return detailed 4xx errors if needed.
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
