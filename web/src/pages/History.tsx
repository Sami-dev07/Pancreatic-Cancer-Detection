import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { PredictionHistoryTable } from "../components/PredictionHistoryTable";
import { loadPredictionHistory } from "../utils/storage";

export function History() {
  const location = useLocation();
  const [rows, setRows] = useState(loadPredictionHistory);

  useEffect(() => {
    setRows(loadPredictionHistory());
  }, [location.pathname, location.key]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <h1 className="font-display text-3xl font-bold text-slate-900">Prediction history</h1>
      <p className="mt-2 max-w-2xl text-slate-600">
        Newest first. Data lives in <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">localStorage</code>{" "}
        on this device only.
      </p>
      <div className="mt-8">
        <PredictionHistoryTable rows={rows} />
      </div>
    </div>
  );
}
