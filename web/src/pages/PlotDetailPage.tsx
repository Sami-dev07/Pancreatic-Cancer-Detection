import { Link, useLocation, useParams } from "react-router-dom";

type NavState = { url?: string; filename?: string } | null;

export function PlotDetailPage() {
  const { filename } = useParams();
  const loc = useLocation();
  const state = (loc.state as NavState) ?? null;

  const title = state?.filename ?? filename ?? "Plot";
  const url = state?.url ?? (filename ? `/static/plots/${filename}` : "");

  return (
    <main className="container">
      <div className="pageHeader rowSpread">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            Served by <code>/static/plots</code>
          </p>
        </div>
        <div className="row">
          <Link className="button" to="/plots">
            Back
          </Link>
          {url ? (
            <a className="button primary" href={url} target="_blank" rel="noreferrer">
              Open image
            </a>
          ) : null}
        </div>
      </div>

      <div className="card">
        {url ? (
          <div className="plotDetail">
            <img src={url} alt={title} />
          </div>
        ) : (
          <div className="muted">No image URL.</div>
        )}
      </div>
    </main>
  );
}

