const CHIP = {
  HIGH: "bg-ember/15 text-ember border-ember/40",
  MEDIUM: "bg-sand/15 text-sand border-sand/40",
  LOW: "bg-sky/15 text-sky border-sky/40",
  INFO: "bg-violet/15 text-violet-soft border-violet/40",
};

export default function ImpactList({ report, selectedId, onSelect }) {
  if (!report) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        Choose a change and run the analysis. Affected items, the graph paths that connect them and a review checklist will appear here.
      </p>
    );
  }
  return (
    <div className="ripple-in space-y-5">
      <div>
        <h2 className="text-base font-semibold">{report.target_name}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{report.summary}</p>
        {report.parsed_from_text && (
          <p className="mt-1 text-xs text-violet-soft">Target detected from your description.</p>
        )}
      </div>

      <ul className="space-y-2">
        {report.findings.map((f) => (
          <li key={f.entity_id}>
            <button
              onClick={() => onSelect(f.entity_id === selectedId ? null : f.entity_id)}
              aria-pressed={f.entity_id === selectedId}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                f.entity_id === selectedId ? "border-violet bg-panel-2" : "border-line bg-panel hover:bg-panel-2"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{f.name}</span>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${CHIP[f.priority]}`}>{f.priority.toLowerCase()}</span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {f.entity_type}, {f.depth} {f.depth === 1 ? "step" : "steps"} away
                {f.evidence_quality === "uncertain" && " · missing source evidence"}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Review checklist</h3>
        <ul className="space-y-2">
          {report.checklist.map((c, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-violet" aria-label={c.action} />
              <span>
                {c.action}
                {c.priority === "INFO" && <span className={`ml-2 rounded-full border px-1.5 text-xs ${CHIP.INFO}`}>suggestion</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Findings come from graph paths. Checklist wording is guidance, not proof that something is broken.
        </p>
      </div>
    </div>
  );
}
