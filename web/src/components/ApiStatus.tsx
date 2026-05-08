import { useCallback, useEffect, useState } from "react";
import { fetchHealth, getApiBaseUrl } from "../services/api";

type Status = "loading" | "connected" | "unavailable" | "no_url";

/**
 * Polls GET /health and shows a compact connection indicator for the top bar.
 */
export function ApiStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [modelHint, setModelHint] = useState<string | null>(null);

  const probe = useCallback(async () => {
    const base = getApiBaseUrl();
    if (!base) {
      setStatus("no_url");
      setModelHint(null);
      return;
    }
    setStatus("loading");
    const h = await fetchHealth();
    if (h == null) {
      setStatus("no_url");
      setModelHint(null);
      return;
    }
    if (h.ok === true) {
      setStatus("connected");
      setModelHint(typeof h.active_model === "string" ? h.active_model : null);
    } else {
      setStatus("unavailable");
      setModelHint(null);
    }
  }, []);

  useEffect(() => {
    void probe();
    const id = window.setInterval(() => void probe(), 30_000);
    return () => window.clearInterval(id);
  }, [probe]);

  const base = getApiBaseUrl();
  const label =
    status === "loading"
      ? "API…"
      : status === "connected"
        ? "API online"
        : status === "unavailable"
          ? "API unreachable"
          : import.meta.env.PROD
            ? "API URL missing"
            : "API URL not set (mock mode)";

  const dot =
    status === "connected"
      ? "bg-emerald-500"
      : status === "unavailable"
        ? "bg-rose-500"
        : status === "loading"
          ? "bg-amber-400 animate-pulse"
          : "bg-slate-400";

  return (
    <div
      className="flex max-w-[min(100vw-8rem,20rem)] items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1.5 text-xs text-slate-700 shadow-sm"
      title={base ?? "Set VITE_API_BASE_URL for live FastAPI calls"}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="truncate font-medium">{label}</span>
      {modelHint && status === "connected" && (
        <span className="hidden truncate text-slate-500 sm:inline">· {modelHint}</span>
      )}
    </div>
  );
}
