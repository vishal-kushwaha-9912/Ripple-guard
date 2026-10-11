import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api.js";
import { Icon } from "../components/Icons.jsx";
import ExplorerCanvas from "../components/ExplorerCanvas.jsx";
import DetailsPanel from "../components/DetailsPanel.jsx";
import SearchBar from "../components/SearchBar.jsx";

const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

function RoundButton({ label, onClick, disabled, icon }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="grid h-11 w-11 place-items-center rounded-full border border-line bg-panel text-text shadow disabled:opacity-35">
      <Icon name={icon} size={18} />
    </button>
  );
}

export default function Dashboard() {
  const [project, setProject] = useState(null);
  const [warning, setWarning] = useState(null);
  const [graph, setGraph] = useState(null);
  const [history, setHistory] = useState([]);
  const [report, setReport] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [show, setShow] = useState({ provides: true, consumes: true });
  const [nav, setNav] = useState({ stack: [], idx: -1 });
  const [fitSignal, setFitSignal] = useState(0);
  const [keys, setKeys] = useState(false);
  const searchRef = useRef(null);

  const focusId = nav.stack[nav.idx] ?? null;

  const visit = useCallback((id) => {
    setSelectedId(null);
    setNav((n) => (n.stack[n.idx] === id ? n : { stack: [...n.stack.slice(0, n.idx + 1), id], idx: n.idx + 1 }));
  }, []);
  const back = () => setNav((n) => (n.idx > 0 ? { ...n, idx: n.idx - 1 } : n));
  const forward = () => setNav((n) => (n.idx < n.stack.length - 1 ? { ...n, idx: n.idx + 1 } : n));

  const refresh = useCallback(async () => {
    try {
      const [p, g, h] = await Promise.all([api.projects(), api.graph(), api.history()]);
      setProject({ ...p.projects[0], backend: p.graph_backend });
      setWarning(p.warning);
      setGraph(g);
      setHistory(h.analyses);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const homeId = useMemo(() => {
    if (!graph) return null;
    const deg = {};
    graph.edges.forEach((e) => { deg[e.from] = (deg[e.from] || 0) + 1; deg[e.to] = (deg[e.to] || 0) + 1; });
    const apis = graph.nodes.filter((n) => n.label === "API");
    return [...(apis.length ? apis : graph.nodes)].sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0))[0]?.id ?? null;
  }, [graph]);

  useEffect(() => {
    if (homeId && nav.idx === -1) setNav({ stack: [homeId], idx: 0 });
  }, [homeId, nav.idx]);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const nodeIndex = useMemo(() => Object.fromEntries((graph?.nodes || []).map((n) => [n.id, n])), [graph]);
  const counts = useMemo(() => {
    if (!graph || !focusId) return { consumes: 0, provides: 0 };
    return {
      consumes: new Set(graph.edges.filter((e) => e.from === focusId).map((e) => e.to)).size,
      provides: new Set(graph.edges.filter((e) => e.to === focusId).map((e) => e.from)).size,
    };
  }, [graph, focusId]);

  const analyze = async (payload) => {
    setBusy(true); setError(null); setSelectedId(null);
    try {
      const r = await api.analyze({ ...payload, target_id: payload.target_id || null });
      setReport(r);
      visit(r.target_id);
      setHistory((await api.history()).analyses);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const analyzeText = (text) => analyze({ description: text, max_depth: 3 });

  const openHistory = async (id) => {
    try { const r = await api.report(id); setReport(r); visit(r.target_id); } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); return; }
      const t = e.target.tagName;
      if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return;
      if (e.altKey && e.key === "ArrowLeft") back();
      else if (e.altKey && e.key === "ArrowRight") forward();
      else if (e.key === "h" && homeId) visit(homeId);
      else if (e.key === "r") setFitSignal((s) => s + 1);
      else if (e.key === "Escape") { setSelectedId(null); setKeys(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [homeId, visit]);

  const node = focusId ? nodeIndex[focusId] : null;

  return (
    <div className="flex h-full flex-col lg:flex-row">
      <div className="relative h-[75vh] shrink-0 overflow-hidden lg:h-full lg:flex-1">
        {graph && focusId && node && (
          <ExplorerCanvas graph={graph} focusId={focusId} report={report} show={show}
            selectedId={selectedId} fitSignal={fitSignal} onFocus={visit} />
        )}

        <div className="absolute left-4 top-4 z-20 flex items-center gap-2">
          <RoundButton label="Home" icon="home" onClick={() => homeId && visit(homeId)} />
          <RoundButton label="Back" icon="left" onClick={back} disabled={nav.idx <= 0} />
          <RoundButton label="Forward" icon="right" onClick={forward} disabled={nav.idx >= nav.stack.length - 1} />
          {project && (
            <span className="ml-2 hidden rounded-full border border-line bg-panel px-4 py-2 text-sm shadow sm:block">
              <span className="font-semibold">RippleGuard</span>
              <span className="text-muted"> {project.name}, {project.node_count} items, {project.backend === "neo4j" ? "Neo4j" : "in-memory graph"}</span>
            </span>
          )}
        </div>

        {(error || warning) && (
          <div role="alert" className="absolute left-1/2 top-4 z-30 max-w-[min(520px,90%)] -translate-x-1/2 rounded-xl border border-ember/40 bg-panel px-4 py-2 text-sm text-ember shadow-lg">
            {error || warning}
          </div>
        )}

        <div className="absolute bottom-6 left-4 z-20 flex items-center gap-2">
          <RoundButton label="Keyboard shortcuts" icon="keyboard" onClick={() => setKeys((k) => !k)} />
          <RoundButton label="Recenter the map" icon="target" onClick={() => setFitSignal((s) => s + 1)} />
          {keys && (
            <div className="absolute bottom-14 left-0 w-64 rounded-xl border border-line bg-panel p-4 text-sm shadow-xl">
              <p className="mb-2 font-semibold">Keyboard shortcuts</p>
              <dl className="space-y-1 text-muted">
                <div className="flex justify-between"><dt>{MOD} K</dt><dd>Search or analyze</dd></div>
                <div className="flex justify-between"><dt>Alt ← / →</dt><dd>Back / forward</dd></div>
                <div className="flex justify-between"><dt>H</dt><dd>Home</dd></div>
                <div className="flex justify-between"><dt>R</dt><dd>Recenter</dd></div>
                <div className="flex justify-between"><dt>Esc</dt><dd>Clear selection</dd></div>
              </dl>
              <p className="mt-2 text-xs text-muted">Drag the map to move, scroll to zoom, click an item to focus it.</p>
            </div>
          )}
        </div>

        {graph && <SearchBar nodes={graph.nodes} onGo={visit} onAnalyze={analyzeText} busy={busy} inputRef={searchRef} hint={MOD} />}
      </div>

      <aside className="w-full shrink-0 overflow-y-auto border-t border-line bg-panel lg:h-full lg:w-[420px] lg:border-l lg:border-t-0">
        {graph && node ? (
          <DetailsPanel node={node} counts={counts} graphNodes={graph.nodes} show={show}
            onToggle={(k) => setShow((s) => ({ ...s, [k]: !s[k] }))} theme={theme}
            onTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} focusId={focusId}
            report={report} selectedId={selectedId} onSelectFinding={setSelectedId}
            history={history} onOpenHistory={openHistory} busy={busy} onAnalyze={analyze}
            onFocus={visit} onOutcome={(id, p) => api.outcome(id, p)} nodeIndex={nodeIndex} />
        ) : (
          <p className="p-6 text-sm text-muted">{error ? "Could not load the graph." : "Loading the project graph…"}</p>
        )}
      </aside>
    </div>
  );
}
