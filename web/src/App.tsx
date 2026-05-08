import { Link, NavLink, Route, Routes } from "react-router-dom";
import { FeaturesPage } from "./pages/FeaturesPage";
import { MetricsPage } from "./pages/MetricsPage";
import { PlotsPage } from "./pages/PlotsPage";
import { PlotDetailPage } from "./pages/PlotDetailPage";

function TopNav() {
  return (
    <header className="topbar">
      <div className="container topbarInner">
        <Link className="brand" to="/">
          Pancreatic Cancer Detection
        </Link>
        <nav className="nav">
          <NavLink to="/features" className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
            Features
          </NavLink>
          <NavLink to="/plots" className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
            Plots
          </NavLink>
          <NavLink to="/metrics" className={({ isActive }) => (isActive ? "navLink active" : "navLink")}>
            Metrics
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function Home() {
  return (
    <main className="container">
      <section className="hero">
        <h1>Pancreatic cancer risk (demo)</h1>
        <p className="muted">
          Web version of the Android app: fill the schema-driven form, view model metrics, and browse evaluation plots.
        </p>
        <div className="ctaRow">
          <Link className="button primary" to="/features">
            Open Features (Predict)
          </Link>
          <Link className="button" to="/plots">
            Open Plots
          </Link>
          <Link className="button" to="/metrics">
            Open Metrics
          </Link>
        </div>
        <p className="disclaimer">
          Note: this is an AI prediction and is <strong>not</strong> a medical diagnosis.
        </p>
      </section>
    </main>
  );
}

export function App() {
  return (
    <div className="app">
      <TopNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/plots" element={<PlotsPage />} />
        <Route path="/plots/:filename" element={<PlotDetailPage />} />
        <Route
          path="*"
          element={
            <main className="container">
              <div className="card">
                <h2>Not found</h2>
                <p className="muted">That page doesn’t exist.</p>
                <Link className="button" to="/">
                  Go home
                </Link>
              </div>
            </main>
          }
        />
      </Routes>
      <footer className="footer">
        <div className="container footerInner">
          <span className="muted">Backend: FastAPI on <code>127.0.0.1:8000</code></span>
          <a className="muted" href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer">
            API docs
          </a>
        </div>
      </footer>
    </div>
  );
}

