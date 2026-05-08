import { useEffect, useMemo, useState } from "react";
import { fetchPlots, getApiBaseUrl, type PlotItem } from "../services/api";

function absoluteUrl(base: string, maybePath: string): string {
  if (/^https?:\/\//i.test(maybePath)) return maybePath;
  if (maybePath.startsWith("/")) return `${base}${maybePath}`;
  return `${base}/${maybePath}`;
}

function PlotCard({ plot, base }: { plot: PlotItem; base: string }) {
  const imgSrc = useMemo(() => absoluteUrl(base, plot.static_url), [base, plot.static_url]);
  const downloadHref = useMemo(
    () => absoluteUrl(base, plot.download_url),
    [base, plot.download_url],
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-card">
      <div className="aspect-[16/10] w-full bg-slate-50">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={imgSrc} className="h-full w-full object-contain" />
      </div>
      <div className="p-5">
        <p className="font-mono text-xs text-slate-500">{plot.filename}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={downloadHref}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl bg-clinical-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-clinical-700"
            target="_blank"
            rel="noreferrer"
          >
            Download
          </a>
          <a
            href={imgSrc}
            className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            target="_blank"
            rel="noreferrer"
          >
            Open
          </a>
        </div>
      </div>
    </article>
  );
}

export function Plots() {
  const [plots, setPlots] = useState<PlotItem[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const base = getApiBaseUrl();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPlots();
        if (!alive) return;
        setPlots(res.plots ?? []);
        setNote(typeof res.note === "string" ? res.note : null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load plots.");
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
      <h1 className="font-display text-3xl font-bold text-slate-900">Model Performance Dashboard</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Plots served by <code className="rounded bg-slate-100 px-1">GET /plots</code> and{" "}
        <code className="rounded bg-slate-100 px-1">/static/plots</code>.
      </p>

      {!base && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Set <code className="rounded bg-amber-100 px-1">VITE_API_BASE_URL</code> to load plots from your API.
        </div>
      )}

      {loading && (
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-card">Loading…</div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      {note && !loading && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {note}
        </div>
      )}

      {!loading && !error && plots.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-16 text-center text-sm text-slate-500">
          No plots available yet. Run training to generate PNGs in the API’s <code className="rounded bg-slate-100 px-1">plots/</code> folder.
        </div>
      )}

      {base && plots.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plots.map((p) => (
            <PlotCard key={p.filename} plot={p} base={base} />
          ))}
        </div>
      )}
    </div>
  );
}

