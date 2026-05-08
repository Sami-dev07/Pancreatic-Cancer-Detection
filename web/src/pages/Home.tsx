import { Link } from "react-router-dom";
import { Disclaimer } from "../components/Disclaimer";

/**
 * Marketing-style landing with hero, value proposition, and CTA to the predictor.
 */
export function Home() {
  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-200/40 via-transparent to-transparent"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-clinical-100/50 via-transparent to-transparent" />

      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-clinical-700">
          Clinical decision support · Research prototype
        </p>
        <h1 className="mt-4 text-center font-display text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
          Pancreatic cancer
          <span className="block bg-gradient-to-r from-clinical-600 to-teal-600 bg-clip-text text-transparent">
            risk screening
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg text-slate-600 sm:text-xl">
          Enter standard clinical biomarkers to obtain an ML-based risk estimate from your FastAPI
          backend—aligned with the same inputs used in the mobile app.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/predict"
            className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl bg-gradient-to-r from-clinical-600 to-clinical-700 px-8 py-3 text-base font-semibold text-white shadow-lg transition hover:from-clinical-700 hover:to-clinical-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
          >
            Custom Patient Prediction
          </Link>
          <Link
            to="/plots"
            className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
          >
            Model Performance Dashboard
          </Link>
          <Link
            to="/metrics"
            className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl border border-slate-300 bg-white px-8 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-clinical-500 focus-visible:ring-offset-2"
          >
            Model Metrics
          </Link>
          <a
            href="#learn-more"
            className="text-sm font-semibold text-clinical-800 underline-offset-4 hover:underline"
          >
            Learn more
          </a>
        </div>

        <div className="mx-auto mt-16 max-w-3xl" id="learn-more">
          <Disclaimer />
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:grid-cols-3">
          {[
            {
              title: "Structured inputs",
              body: "Age, sex, CA19-9, creatinine, LYVE1, REG1B, and TFF1—validated before submit.",
            },
            {
              title: "Server-side models",
              body: "No client-side model: every prediction is computed by your trained FastAPI service.",
            },
            {
              title: "Demo-ready UI",
              body: "Responsive, accessible layout suitable for academic presentation or stakeholder review.",
            },
          ].map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-card backdrop-blur-sm"
            >
              <h2 className="font-display text-lg font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
