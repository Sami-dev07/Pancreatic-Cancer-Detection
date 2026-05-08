import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { PredictionHistoryEntry } from "../../types/prediction";
import { biomarkerMaxima, radarRowsForEntry } from "../../utils/chartData";

export function BiomarkerRadarChart({
  history,
  entry,
}: {
  history: PredictionHistoryEntry[];
  entry: PredictionHistoryEntry;
}) {
  if (history.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 text-center text-sm text-slate-500">
        No history to scale biomarkers.
      </div>
    );
  }

  const maxima = biomarkerMaxima(history);
  const rows = radarRowsForEntry(entry, maxima);

  return (
    <div className="h-80 w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card">
      <h3 className="text-sm font-semibold text-slate-800">Biomarker profile (normalized)</h3>
      <p className="text-xs text-slate-500">Each axis scaled to the max seen in your saved history (0–100).</p>
      <ResponsiveContainer width="100%" height="86%">
        <RadarChart data={rows} cx="50%" cy="52%" outerRadius="70%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar name="This run" dataKey="value" stroke="#0284c7" fill="#0ea5e9" fillOpacity={0.35} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(0)}`, "Relative level"]} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
