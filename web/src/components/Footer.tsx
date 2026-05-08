/**
 * Site footer with attribution and secondary disclaimer line.
 */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white/80 py-8 text-center text-sm text-slate-600">
      <div className="mx-auto max-w-3xl px-4">
        <p>
          Pancreatic Cancer Risk Assessment — university / research demo. Models and API are for
          demonstration only.
        </p>
        <p className="mt-2 text-slate-500">
          © {new Date().getFullYear()} — Not intended for clinical use without proper validation and
          regulatory approval.
        </p>
      </div>
    </footer>
  );
}
