import { Link } from "react-router-dom";
import type { PredictionHistoryEntry } from "../types/prediction";

function shortRec(pred: number): string {
  return pred === 1
    ? "Discuss with a clinician; not a diagnosis."
    : "Routine follow-up per physician; not definitive.";
}

export function PredictionHistoryTable({ rows }: { rows: PredictionHistoryEntry[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center text-sm text-slate-500">
        No saved predictions yet. Submit the form on <Link className="font-semibold text-clinical-700 underline" to="/predict">Predict</Link> to build history (stored locally in this browser).
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-card">
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
          <tr>
            <th className="px-4 py-3">Date / time</th>
            <th className="px-4 py-3">Age</th>
            <th className="px-4 py-3">Sex</th>
            <th className="px-4 py-3">Probability</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3">Recommendation</th>
            <th className="px-4 py-3"> </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const prob =
              r.result.probability != null ? `${(r.result.probability * 100).toFixed(1)}%` : "—";
            const risk = r.result.prediction === 1 ? "High" : "Low";
            return (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="whitespace-nowrap px-4 py-3 text-slate-800">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">{r.features.age}</td>
                <td className="px-4 py-3">{r.features.sex}</td>
                <td className="px-4 py-3 font-medium">{prob}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      r.result.prediction === 1
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {risk}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-600">{shortRec(r.result.prediction)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    to={`/result/${r.id}`}
                    className="font-semibold text-clinical-700 hover:text-clinical-800"
                  >
                    Details
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
