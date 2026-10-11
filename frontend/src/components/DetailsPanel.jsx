import { useState } from "react";
import { Icon, TypeIcon } from "./Icons.jsx";
import ChangeForm from "./ChangeForm.jsx";
import ImpactList from "./ImpactList.jsx";
import EvidencePath from "./EvidencePath.jsx";

const LABELS = { id: "Entity ID", type: "Component Type", path: "Path", version: "Version", status: "Status", language: "Primary Languages", critical: "Critical", title: "Title" };
const HIDDEN = new Set(["name", "label", "description", "project_id"]);

function describe(node, counts) {
  if (node.description) return node.description;
  const kind = node.label.toLowerCase();
  const bits = [`${node.name} is ${/^[aeiou]/.test(kind) ? "an" : "a"} ${kind}`];
  if (node.path) bits.push(`at ${node.path}`);
  if (node.version) bits.push(`(version ${node.version})`);
  const deps = `It uses ${counts.consumes} ${counts.consumes === 1 ? "item" : "items"} and ${counts.provides} ${counts.provides === 1 ? "item depends" : "items depend"} on it.`;
  return `${bits.join(" ")}. ${deps}`;
}

function Section({ title, children }) {
  return (
    <section className="space-y-3 px-6 py-5">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

export default function DetailsPanel({
  node, counts, graphNodes, show, onToggle, theme, onTheme, focusId,
  report, selectedId, onSelectFinding, history, onOpenHistory, busy, onAnalyze, onFocus, onOutcome, nodeIndex,
}) {
  const [copied, setCopied] = useState(false);
  const [more, setMore] = useState(false);
  const finding = report?.findings.find((f) => f.entity_id === selectedId) || null;
  const chip = node.path || node.name;
  const desc = describe(node, counts);
  const long = desc.length > 160;

  const copy = async () => {
    try { await navigator.clipboard.writeText(chip); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* ignore */ }
  };

  const rows = Object.entries(node).filter(([k]) => !HIDDEN.has(k)).map(([k, v]) => [LABELS[k] || k, v === true ? "Yes" : String(v)]);
  rows.splice(1, 0, ["Entity Type", node.label]);

  return (
    <div className="divide-y divide-line">
      <div className="flex items-center justify-between px-6 py-4">
        <h2 className="text-lg font-semibold">Details</h2>
        <button onClick={onTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className="grid h-9 w-9 place-items-center rounded-full text-sand hover:bg-panel-2">
          <Icon name={theme === "dark" ? "sun" : "moon"} size={20} />
        </button>
      </div>

      <div className="flex items-center gap-4 px-6 py-5">
        <TypeIcon type={node.label} size={64} />
        <div className="min-w-0">
          <div className="truncate text-2xl font-semibold">{node.name}</div>
          <div className="text-sm tracking-wide text-muted">{node.label.toUpperCase()}</div>
        </div>
      </div>

      <Section title="Description">
        <p className={`text-base leading-relaxed ${!more && long ? "line-clamp-3" : ""}`}>{desc}</p>
        {long && <button onClick={() => setMore(!more)} className="text-sm font-medium text-sky">{more ? "Show less" : "Show more"}</button>}
        <button onClick={copy} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 font-mono text-sm hover:bg-panel-2" aria-label={`Copy ${chip}`}>
          {chip} <Icon name="copy" size={14} className="text-violet-soft" />
          {copied && <span className="font-sans text-xs text-violet-soft">Copied</span>}
        </button>
      </Section>

      <Section title="Integrations">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => onToggle("provides")} aria-pressed={show.provides}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-opacity ${show.provides ? "bg-violet/30 text-violet-soft" : "bg-panel-2 text-muted opacity-70"}`}>
            <Icon name="up" size={16} /> Provides <span className="rounded-full bg-black/25 px-2">{counts.provides}</span>
          </button>
          <button onClick={() => onToggle("consumes")} aria-pressed={show.consumes}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition-opacity ${show.consumes ? "bg-indigo-500/25 text-sky" : "bg-panel-2 text-muted opacity-70"}`}>
            <Icon name="down" size={16} /> Consumes <span className="rounded-full bg-black/25 px-2">{counts.consumes}</span>
          </button>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Consumes: items this one uses, drawn above. Provides: items that depend on it, drawn below. These are the ones a change here can reach.
        </p>
      </Section>

      <Section title="Impact analysis">
        <ChangeForm nodes={graphNodes} focusId={focusId} busy={busy} onSubmit={onAnalyze} />
      </Section>

      {report && (
        <Section title="Latest analysis">
          {report.target_id !== focusId && (
            <button onClick={() => onFocus(report.target_id)} className="text-sm font-medium text-sky">Show {report.target_name} on the map</button>
          )}
          <ImpactList report={report} selectedId={selectedId} onSelect={onSelectFinding} />
        </Section>
      )}

      {finding && (
        <Section title="Evidence">
          <EvidencePath key={finding.entity_id} report={report} finding={finding} nodeIndex={nodeIndex} onOutcome={onOutcome} />
        </Section>
      )}

      <Section title="Past analyses">
        {history.length === 0 ? (
          <p className="text-sm text-muted">Nothing analyzed yet.</p>
        ) : (
          <ul className="space-y-1">
            {history.slice(0, 6).map((h) => (
              <li key={h.analysis_id}>
                <button onClick={() => onOpenHistory(h.analysis_id)} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-panel-2">
                  <span className="block">{h.target_name}</span>
                  <span className="block text-xs text-muted">{new Date(h.timestamp).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <section className="px-6 py-5">
        <div className="rounded-xl bg-panel-2 p-5">
          <h3 className="mb-3 text-sm font-medium text-muted">Documentation</h3>
          <h4 className="mb-3 text-xl font-semibold">Component Metadata</h4>
          <table className="w-full text-left text-sm">
            <thead><tr className="bg-ink/60"><th className="px-3 py-2 font-semibold">Field</th><th className="px-3 py-2 font-semibold">Value</th></tr></thead>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k} className="border-t border-line align-top">
                  <th className="px-3 py-2.5 font-semibold">{k}</th>
                  <td className="break-all px-3 py-2.5 text-muted">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
