import { useEffect, useMemo, useState } from "react";
import { apiGet, type ModelSummaryResponse } from "../api";

function pct(v: number | null | undefined) {
  if (v == null) return "n/a";
  return (v * 100).toFixed(6);
}

export function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ModelSummaryResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        const resp = await apiGet<ModelSummaryResponse>("/model/summary");
        if (!active) return;
        setData(resp);
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

  const chips = useMemo(() => {
    const m = data?.metrics ?? {};
    return [
      { key: "accuracy", label: `ACC ${pct(m["accuracy"])}` },
      { key: "f1_score", label: `F1 ${pct(m["f1_score"])}` },
      { key: "sensitivity", label: `SEN ${pct(m["sensitivity"])}` },
      { key: "specificity", label: `SPEC ${pct(m["specificity"])}` },
      { key: "precision", label: `PRE ${pct(m["precision"])}` },
      { key: "roc_auc", label: `AUC ${pct(m["roc_auc"])}` },
      { key: "fnr", label: `FNR ${pct(m["fnr"])}` }
    ];
  }, [data]);

  return (
    <main className="container">
      <div className="pageHeader">
        <h2>Metrics</h2>
        <p className="muted">From <code>/model/summary</code> (mirrors the Android “Metrics” screen).</p>
      </div>

      {loading ? (
        <div className="card">Loading /model/summary…</div>
      ) : error ? (
        <div className="card danger">
          <div className="cardTitle">Error</div>
          <pre className="pre">{error}</pre>
        </div>
      ) : data ? (
        <div className="card">
          <div className="cardTitle">Best model: {data.best_model ?? "unknown"}</div>
          <div className="chips">
            {chips.map((c) => (
              <span className="chip" key={c.key}>
                {c.label}
              </span>
            ))}
          </div>
          <div className="details">
            <div><span className="k">Target</span> <span className="v">{data.target_definition ?? "n/a"}</span></div>
            <div><span className="k">Accuracy</span> <span className="v">{pct(data.metrics["accuracy"])}</span></div>
            <div><span className="k">Precision</span> <span className="v">{pct(data.metrics["precision"])}</span></div>
            <div><span className="k">Sensitivity</span> <span className="v">{pct(data.metrics["sensitivity"])}</span></div>
            <div><span className="k">Specificity</span> <span className="v">{pct(data.metrics["specificity"])}</span></div>
            <div><span className="k">F1 score</span> <span className="v">{pct(data.metrics["f1_score"])}</span></div>
            <div><span className="k">ROC AUC</span> <span className="v">{pct(data.metrics["roc_auc"])}</span></div>
            <div><span className="k">False negative rate (FNR)</span> <span className="v">{pct(data.metrics["fnr"])}</span></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

