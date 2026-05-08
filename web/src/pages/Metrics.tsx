import { useEffect, useState } from "react";
import { fetchModelSummary, type ModelSummaryResponse } from "../services/api";

function MetricChip({ label, value }: { label: string; value: number | null | undefined }) {
  const v = value == null ? "—" : Number.isFinite(value) ? value.toFixed(3) : "—";
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-slate-900">{v}</p>
    </div>
  );
}

export function Metrics() {
  const [data, setData] = useState<ModelSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await fetchModelSummary();
        if (!alive) return;
        setData(s);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load metrics.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold text-slate-900">Model Metrics</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Summary metrics from <code className="rounded bg-slate-100 px-1">GET /model/summary</code>.
      </p>

      {loading && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          Loading...
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          <div className="mt-8 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              Best model: <span className="font-mono">{data.best_model ?? "—"}</span>
            </p>
            {data.target_definition && (
              <p className="mt-2 text-sm text-slate-600">{data.target_definition}</p>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data.metrics ?? {}).map(([k, v]) => (
              <MetricChip key={k} label={k.replaceAll("_", " ")} value={v} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

