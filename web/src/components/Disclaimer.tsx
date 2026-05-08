/**
 * Prominent non-diagnosis disclaimer for regulatory / academic clarity.
 */
export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <aside
      className={
        compact
          ? "rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
          : "rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-amber-950 shadow-sm"
      }
      role="note"
    >
      <p className="font-display font-semibold text-amber-900">Important medical disclaimer</p>
      <p className={`mt-2 text-amber-900/90 ${compact ? "text-sm leading-relaxed" : "mt-3 leading-relaxed"}`}>
        This tool is a <strong>research and educational demonstration</strong> only. It does{" "}
        <strong>not</strong> provide a medical diagnosis, treatment recommendation, or substitute for
        professional clinical judgment. Always consult a qualified healthcare provider for health
        decisions.
      </p>
    </aside>
  );
}
