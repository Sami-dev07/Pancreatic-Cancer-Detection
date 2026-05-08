import { NavLink } from "react-router-dom";

const item =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `${item} ${isActive ? "bg-clinical-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"}`;

const links = [
  { to: "/", end: true, label: "Home" },
  { to: "/predict", label: "Custom Patient Prediction" },
  { to: "/plots", label: "Model Performance Dashboard" },
  { to: "/metrics", label: "Model Metrics" },
  { to: "/models", label: "Select Prediction Model" },
  { to: "/history", label: "History" },
] as const;

export function Sidebar({
  onNavigate,
  className = "",
}: {
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <aside className={`flex flex-col border-r border-slate-200 bg-white ${className}`}>
      <div className="border-b border-slate-100 px-4 py-5">
        <NavLink to="/" className="group flex items-center gap-2" onClick={onNavigate}>
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-clinical-600 to-clinical-900 text-lg font-bold text-white shadow-md"
            aria-hidden
          >
            P
          </span>
          <div>
            <p className="font-display text-base font-semibold text-slate-900">PDAC Risk Lab</p>
            <p className="text-xs text-slate-500">Screening dashboard</p>
          </div>
        </NavLink>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3" aria-label="Sidebar">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={"end" in l ? l.end : false}
            className={navClass}
            onClick={onNavigate}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
