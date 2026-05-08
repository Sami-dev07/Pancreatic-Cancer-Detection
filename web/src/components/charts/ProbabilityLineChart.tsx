import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PredictionHistoryEntry } from "../../types/prediction";

export function ProbabilityLineChart({ history }: { history: PredictionHistoryEntry[] }) {
  const withProb = history.filter((h) => h.result.probability != null && Number.isFinite(h.result.probability!));

  if (withProb.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 text-center text-sm text-slate-500">
        No probability values in history yet.
      </div>
    );
  }

  const chronological = [...withProb].reverse();
  const data = chronological.map((h) => ({
    t: new Date(h.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    p: Math.round((h.result.probability as number) * 1000) / 10,
  }));

  return (
    <div className="h-72 w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card">
      <h3 className="text-sm font-semibold text-slate-800">Probability over time</h3>
      <p className="text-xs text-slate-500">Chronological order · PDAC probability (%)</p>
      <ResponsiveContainer width="100%" height="82%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="t" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={36} tickFormatter={(v) => `${v}%`} />
          <Tooltip formatter={(v: number) => [`${v}%`, "Probability"]} />
          <Line type="monotone" dataKey="p" stroke="#0369a1" strokeWidth={2} dot name="PDAC %" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
