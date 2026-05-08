import { Link, useParams } from "react-router-dom";
import { BiomarkerBarChart } from "../components/charts/BiomarkerBarChart";
import { BiomarkerRadarChart } from "../components/charts/BiomarkerRadarChart";
import { Disclaimer } from "../components/Disclaimer";
import { ResultCard } from "../components/ResultCard";
import { exportPredictionPdf } from "../utils/pdfExport";
import { getHistoryEntryById, loadPredictionHistory } from "../utils/storage";

export function Result() {
  const { id } = useParams<{ id: string }>();
  const entry = id ? getHistoryEntryById(id) : undefined;
  const history = loadPredictionHistory();

  if (!entry) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-900">Result not found</h1>
        <p className="mt-3 text-slate-600">
          This link may be invalid or the entry was cleared from browser storage.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/predict"
            className="inline-flex rounded-xl bg-clinical-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-clinical-700"
          >
            New prediction
          </Link>
          <Link to="/history" className="text-sm font-semibold text-clinical-800 underline-offset-4 hover:underline">
            View history
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saved result</p>
      <h1 className="mt-1 font-display text-3xl font-bold text-slate-900">Prediction details</h1>
      <p className="mt-2 text-sm text-slate-600">
        Recorded {new Date(entry.createdAt).toLocaleString()} · ID <span className="font-mono text-xs">{entry.id}</span>
      </p>

      <div className="mt-8 space-y-8">
        <ResultCard
          result={entry.result}
          extraActions={
            <>
              <button
                type="button"
                onClick={() => exportPredictionPdf(entry)}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Download PDF
              </button>
              <Link
                to="/predict"
                className="inline-flex items-center justify-center rounded-xl bg-clinical-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-clinical-700"
              >
                Run another prediction
              </Link>
            </>
          }
        />

        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-8">
          <h2 className="font-display text-lg font-semibold text-slate-900">Input summary</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Age", `${entry.features.age} yr`],
                ["Sex", entry.features.sex],
                ["Plasma CA19-9", String(entry.features.plasma_CA19_9)],
                ["Creatinine", String(entry.features.creatinine)],
                ["LYVE1", String(entry.features.LYVE1)],
                ["REG1B", String(entry.features.REG1B)],
                ["TFF1", String(entry.features.TFF1)],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
                <dt className="text-sm text-slate-500">{k}</dt>
                <dd className="text-sm font-semibold text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-6">
          <h2 className="font-display text-lg font-semibold text-slate-900">Biomarker charts</h2>
          <div className="grid gap-6 lg:grid-cols-1">
            <BiomarkerBarChart features={entry.features} />
            <BiomarkerRadarChart history={history} entry={entry} />
          </div>
        </section>

        <Disclaimer compact />
      </div>
    </div>
  );
}
