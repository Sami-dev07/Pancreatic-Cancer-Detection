import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PredictionHistoryEntry } from "../../types/prediction";
import { barRowsForFeatures } from "../../utils/chartData";

export function BiomarkerBarChart({ features }: { features: PredictionHistoryEntry["features"] }) {
  const rows = barRowsForFeatures(features);

  return (
    <div className="h-72 w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card">
      <h3 className="text-sm font-semibold text-slate-800">Biomarker levels</h3>
      <ResponsiveContainer width="100%" height="88%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={48} />
          <YAxis tick={{ fontSize: 11 }} width={40} />
          <Tooltip />
          <Bar dataKey="value" fill="#0284c7" radius={[6, 6, 0, 0]} name="Value" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
