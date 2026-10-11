import { useState } from "react";

export default function EvidencePath({ report, finding, nodeIndex, onOutcome }) {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(null);

  if (!finding) {
    return <p className="text-sm text-muted">Select an affected item to see the exact path that connects it to the change.</p>;
  }
  const name = (id) => nodeIndex[id]?.name || id;

  const submit = async (confirmed) => {
    await onOutcome(report.analysis_id, { entity_id: finding.entity_id, confirmed, note });
    setSaved(confirmed ? "Marked as confirmed. Future analyses will highlight it." : "Marked as not affected.");
  };

  return (
    <div className="ripple-in space-y-3">
      <h3 className="text-sm font-semibold">Why {finding.name} is flagged</h3>
      <p className="text-sm text-muted">{finding.reason}</p>

      {finding.paths.map((ids, p) => (
        <ol key={p} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {ids.map((id, i) => {
            const rel = i > 0 ? finding.path_relationships[p][i - 1] : null;
            return (
              <li key={id} className="flex items-center gap-2">
                {rel && <span className="rounded bg-panel-2 px-1.5 py-0.5 text-xs text-violet-soft">{rel.replace("_", " ").toLowerCase()}</span>}
                <span className={i === 0 ? "font-semibold text-violet-soft" : ""}>{name(id)}</span>
              </li>
            );
          })}
        </ol>
      ))}
      <p className="text-xs text-muted">Read each path from the changed item outward; the label shows how the next item depends on the previous one.</p>

      {finding.history.length > 0 && (
        <div className="rounded-lg border border-ember/40 bg-ember/10 p-2 text-xs text-ember">
          Confirmed in an earlier change: {finding.history.join("; ")}
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-3">
        <p className="text-sm">After reviewing, was it affected?</p>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note, e.g. needed new field name"
          className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm placeholder:text-muted"
        />
        <div className="flex gap-2">
          <button onClick={() => submit(true)} className="rounded-lg bg-violet px-3 py-1.5 text-sm font-medium text-white">Yes, it needed changes</button>
          <button onClick={() => submit(false)} className="rounded-lg border border-line px-3 py-1.5 text-sm">No, unaffected</button>
        </div>
        {saved && <p className="text-xs text-violet-soft" role="status">{saved}</p>}
      </div>
    </div>
  );
}
