import { useEffect, useState } from "react";
import {
  fetchActiveModel,
  fetchModels,
  selectActiveModel,
  type ModelInfo,
  type ModelKey,
} from "../services/api";

function ModelCard({
  model,
  onSelect,
  busy,
}: {
  model: ModelInfo;
  onSelect: (key: ModelKey) => void;
  busy: boolean;
}) {
  const tone = model.active ? "border-clinical-300 bg-clinical-50/50" : "border-slate-200 bg-white";
  return (
    <article className={`rounded-2xl border p-6 shadow-card ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">{model.name}</h2>
          <p className="mt-1 text-sm text-slate-600">{model.description}</p>
        </div>
        {model.active && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            ✓ Active
          </span>
        )}
      </div>

      {!model.loaded && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900 ring-1 ring-rose-100">
          ⚠ Model not trained/loaded yet
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy || model.active || !model.loaded}
          onClick={() => onSelect(model.key)}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-clinical-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-clinical-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {model.active ? "Active" : busy ? "Switching..." : "Select"}
        </button>
      </div>
    </article>
  );
}

export function Models() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [activeNote, setActiveNote] = useState<string>("");
  const [busyKey, setBusyKey] = useState<ModelKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [m, active] = await Promise.all([fetchModels(), fetchActiveModel()]);
      setModels(m.available_models);
      setActiveNote(
        `Currently active: ${active.model_full_name}${active.loaded ? "" : " (not loaded)"}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load models.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSelect = async (key: ModelKey) => {
    setBusyKey(key);
    setError(null);
    try {
      await selectActiveModel(key);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Switch failed.");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold text-slate-900">Select Prediction Model</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        This changes the server-side <code className="rounded bg-slate-100 px-1">active model</code>{" "}
        used by <code className="rounded bg-slate-100 px-1">POST /predict</code> when no per-request{" "}
        <code className="rounded bg-slate-100 px-1">model</code> override is provided.
      </p>
      <p className="mt-2 text-sm text-slate-500">{activeNote}</p>

      {error && (
        <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {models.map((m) => (
          <ModelCard key={m.key} model={m} onSelect={onSelect} busy={busyKey === m.key} />
        ))}
      </div>
    </div>
  );
}

