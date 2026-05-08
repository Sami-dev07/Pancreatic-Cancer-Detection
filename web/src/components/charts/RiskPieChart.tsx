import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { HistoryStats } from "../../types/prediction";

const COLORS = ["#f43f5e", "#10b981"];

export function RiskPieChart({ stats }: { stats: HistoryStats }) {
  if (stats.total === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 text-center text-sm text-slate-500">
        Run predictions to see high vs low risk distribution.
      </div>
    );
  }

  const data = [
    { name: "High risk", value: stats.highRisk },
    { name: "Low risk", value: stats.lowRisk },
  ];

  return (
    <div className="h-72 w-full rounded-2xl border border-slate-200/90 bg-white p-4 shadow-card">
      <h3 className="text-sm font-semibold text-slate-800">Risk mix</h3>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [v, "Count"]} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
