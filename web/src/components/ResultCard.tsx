import type { ReactNode } from "react";
import type { PredictResponseBody } from "../types/prediction";

function riskFromPrediction(pred: number): { label: string; tone: string } {
  if (pred === 1) {
    return {
      label: "Elevated risk signal",
      tone: "from-rose-500 to-orange-500",
    };
  }
  return {
    label: "Lower risk signal",
    tone: "from-emerald-500 to-teal-500",
  };
}

/**
 * Presents prediction outcome, probability, risk framing, and model metadata.
 */
export function ResultCard({
  result,
  onReset,
  extraActions,
}: {
  result: PredictResponseBody;
  onReset?: () => void;
  extraActions?: ReactNode;
}) {
  const probPct =
    result.probability != null ? `${(result.probability * 100).toFixed(1)}%` : "—";
  const confPct =
    result.confidence != null ? `${(result.confidence * 100).toFixed(1)}%` : "—";
  const risk = riskFromPrediction(result.prediction);
  const highRisk = result.prediction === 1;

  return (
    <section
      className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card-lg sm:p-8"
      aria-live="polite"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outcome</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            {highRisk ? "High-risk pattern" : "Low-risk pattern"}
          </h2>
          <p className="mt-2 max-w-xl text-slate-600">{result.message}</p>
        </div>
        <div
          className={`shrink-0 rounded-2xl bg-gradient-to-br px-5 py-4 text-center text-white shadow-lg ${risk.tone}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-white/90">Risk indicator</p>
          <p className="mt-1 font-display text-xl font-bold">{risk.label}</p>
        </div>
      </div>

      <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <dt className="text-xs font-medium text-slate-500">PDAC probability</dt>
          <dd className="mt-1 font-display text-xl font-semibold text-slate-900">{probPct}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <dt className="text-xs font-medium text-slate-500">Confidence</dt>
          <dd className="mt-1 font-display text-xl font-semibold text-slate-900">{confPct}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <dt className="text-xs font-medium text-slate-500">Model</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">{result.model_name}</dd>
          <dd className="text-xs text-slate-500">Key: {result.model_used}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <dt className="text-xs font-medium text-slate-500">Class label</dt>
          <dd className="mt-1 font-mono text-sm font-semibold text-slate-900">{result.predicted_label}</dd>
        </div>
      </dl>

      <p className="mt-6 rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-950 ring-1 ring-sky-100">
        <strong>Recommendation:</strong>{" "}
        {highRisk
          ? "Share these results with a clinician for interpretation; do not self-diagnose."
          : "Continue routine care as advised by your physician; this screen is not definitive."}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-xl bg-clinical-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-clinical-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
          >
            Run another prediction
          </button>
        )}
        {extraActions}
      </div>
    </section>
  );
}
