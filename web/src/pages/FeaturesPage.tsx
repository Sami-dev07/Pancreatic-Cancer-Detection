import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, type PredictionSchemaResponse, type PredictResponse, type SchemaField } from "../api";

type FormState = Record<string, string>;

function isNumberField(f: SchemaField) {
  return f.type === "number";
}

function FieldRow(props: {
  field: SchemaField;
  value: string;
  onChange: (v: string) => void;
}) {
  const { field, value, onChange } = props;
  const options = (field.options ?? []) as Array<string | number>;
  const hasOptions = Array.isArray(options) && options.length > 0;

  return (
    <div className="fieldRow">
      <div className="fieldMeta">
        <div className="fieldLabel">
          {field.label} {field.required !== false ? <span className="req">*</span> : null}
        </div>
        <div className="fieldName muted">{field.name}</div>
      </div>

      <div className="fieldControl">
        {hasOptions ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
            <option value="">Select…</option>
            {options.map((o) => (
              <option key={String(o)} value={String(o)}>
                {String(o)}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isNumberField(field) ? "Enter a number" : "Enter a value"}
            inputMode={isNumberField(field) ? "decimal" : "text"}
          />
        )}

        <div className="hint muted">
          {isNumberField(field) ? (
            <>
              {field.min != null ? <>min {field.min}</> : null}
              {field.min != null && field.max != null ? " · " : null}
              {field.max != null ? <>max {field.max}</> : null}
            </>
          ) : (
            <span>categorical</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeaturesPage() {
  const [loading, setLoading] = useState(true);
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [form, setForm] = useState<FormState>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        const schema = await apiGet<PredictionSchemaResponse>("/prediction/schema");
        if (!active) return;
        setFields(schema.fields || []);
        const initial: FormState = {};
        (schema.fields || []).forEach((f) => {
          initial[f.name] = "";
        });
        setForm(initial);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const requiredMissing = useMemo(() => {
    const missing: string[] = [];
    for (const f of fields) {
      if (f.required === false) continue;
      const v = (form[f.name] ?? "").trim();
      if (!v) missing.push(f.name);
    }
    return missing;
  }, [fields, form]);

  async function onPredict() {
    setResult(null);
    setError(null);
    if (requiredMissing.length) {
      setError(`Missing required fields: ${requiredMissing.join(", ")}`);
      return;
    }

    const featuresPayload: Record<string, unknown> = {};
    for (const f of fields) {
      const raw = (form[f.name] ?? "").trim();
      if (isNumberField(f)) {
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          setError(`Field "${f.label}" must be numeric.`);
          return;
        }
        featuresPayload[f.name] = num;
      } else {
        featuresPayload[f.name] = raw;
      }
    }

    setBusy(true);
    try {
      const resp = await apiPost<PredictResponse>("/predict", { features: featuresPayload });
      setResult(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container">
      <div className="pageHeader">
        <h2>Features (Prediction)</h2>
        <p className="muted">Loaded from <code>/prediction/schema</code>. Fill all required fields, then Predict.</p>
      </div>

      {loading ? (
        <div className="card">Loading /prediction/schema…</div>
      ) : error ? (
        <div className="card danger">
          <div className="cardTitle">Error</div>
          <pre className="pre">{error}</pre>
          <div className="muted">
            If you see <code>503 Model pipeline not found</code>, run <code>python ml/train.py</code> then restart the API.
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="grid">
              {fields.map((f) => (
                <FieldRow
                  key={f.name}
                  field={f}
                  value={form[f.name] ?? ""}
                  onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))}
                />
              ))}
            </div>
            <div className="row">
              <button className="button primary" onClick={onPredict} disabled={busy}>
                {busy ? "Predicting…" : "Predict"}
              </button>
              <span className="muted">
                {fields.length ? (
                  <>
                    {fields.length} fields · <span className={requiredMissing.length ? "warn" : ""}>{requiredMissing.length}</span> missing
                  </>
                ) : (
                  "No fields found (train model first)."
                )}
              </span>
            </div>
          </div>

          {result ? (
            <div className="card">
              <div className="cardTitle">Result</div>
              <div className="resultGrid">
                <div>
                  <div className="k">Predicted label</div>
                  <div className="v">{result.predicted_label}</div>
                </div>
                <div>
                  <div className="k">Class</div>
                  <div className="v">{result.prediction} (1=cancer, 0=no cancer)</div>
                </div>
                <div>
                  <div className="k">Cancer probability</div>
                  <div className="v">{result.probability ?? "n/a"}</div>
                </div>
                <div>
                  <div className="k">Confidence</div>
                  <div className="v">{result.confidence ?? "n/a"}</div>
                </div>
              </div>
              <div className="muted">{result.message}</div>
              <div className="disclaimer">
                Note: this is an AI prediction, not a medical diagnosis.
              </div>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

