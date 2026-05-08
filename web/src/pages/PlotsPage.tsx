import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiGet, type ModelPerformanceBlocksResponse } from "../api";

function formatChipLabel(label: string) {
  const parts = label.trim().split(" ");
  if (parts.length !== 2) return label;
  const prefix = parts[0];
  const raw = Number(parts[1]);
  if (!Number.isFinite(raw)) return label;
  return `${prefix} ${(raw * 100).toFixed(6)}`;
}

function safeEncodeFilename(filename: string) {
  return encodeURIComponent(filename).replaceAll("%2F", "/");
}

export function PlotsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ModelPerformanceBlocksResponse | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        const resp = await apiGet<ModelPerformanceBlocksResponse>("/model/performance/blocks");
        if (!active) return;
        setData(resp);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => data?.blocks?.find((b) => b.id === "summary"), [data]);
  const otherBlocks = useMemo(() => (data?.blocks ?? []).filter((b) => b.id !== "summary"), [data]);

  return (
    <main className="container">
      <div className="pageHeader">
        <h2>Plots</h2>
        <p className="muted">
          Compact dashboard from <code>/model/performance/blocks</code> (mirrors the Android “Plots” screen).
        </p>
      </div>

      {loading ? (
        <div className="card">Loading dashboard…</div>
      ) : error ? (
        <div className="card danger">
          <div className="cardTitle">Error</div>
          <pre className="pre">{error}</pre>
        </div>
      ) : data ? (
        <>
          <div className="card">
            <div className="cardTitle">Best model: {data.best_model ?? "unknown"}</div>
            <div className="chips">
              {(summary?.chips ?? []).map((c, idx) => (
                <span className="chip" key={`${c.label}-${idx}`}>
                  {formatChipLabel(c.label)}
                </span>
              ))}
            </div>
          </div>

          <div className="layout2">
            <div className="stack">
              {otherBlocks.map((b) => (
                <div className="card" key={b.id}>
                  <div className="cardTitle">{b.title}</div>
                  <ul className="lines">
                    {(b.lines ?? []).map((line, idx) => (
                      <li key={idx} className="line">
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="cardTitle">Plots</div>
              <div className="plotGrid">
                {(data.plots ?? []).map((p) => (
                  <Link
                    key={p.filename}
                    className="plotTile"
                    to={`/plots/${safeEncodeFilename(p.filename)}`}
                    state={{ url: p.static_url, filename: p.filename }}
                    title={p.filename}
                  >
                    <div className="plotThumb">
                      <img loading="lazy" src={p.static_url} alt={p.filename} />
                    </div>
                    <div className="plotMeta">
                      <div className="plotName">{p.filename}</div>
                      <div className="muted">{Math.round((p.bytes ?? 0) / 1024)} KB</div>
                    </div>
                  </Link>
                ))}
              </div>
              {(data.plots ?? []).length === 0 ? (
                <div className="muted">
                  No plots found yet. Generate them by running training/validation to populate the <code>plots/</code> folder.
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}

