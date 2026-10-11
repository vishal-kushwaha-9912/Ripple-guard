import { useMemo, useState } from "react";
import { Icon, TypeIcon } from "./Icons.jsx";

export default function SearchBar({ nodes, onGo, onAnalyze, busy, inputRef, hint }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return nodes.filter((n) => [n.id, n.name, n.path, n.title].some((v) => v && String(v).toLowerCase().includes(s))).slice(0, 6);
  }, [q, nodes]);

  const options = [
    ...matches.map((n) => ({ kind: "node", n })),
    ...(q.trim().length > 3 ? [{ kind: "analyze" }] : []),
  ];

  const choose = (o) => {
    if (!o || busy) return;
    if (o.kind === "node") onGo(o.n.id);
    else onAnalyze(q.trim());
    setQ(""); setOpen(false); setI(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setI((v) => Math.min(options.length - 1, v + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setI((v) => Math.max(0, v - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(options[i]); }
    else if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
  };

  return (
    <div className="absolute bottom-6 left-1/2 z-20 w-[min(560px,calc(100%-32px))] -translate-x-1/2">
      {open && options.length > 0 && (
        <ul role="listbox" className="absolute bottom-full mb-2 w-full overflow-hidden rounded-xl border border-line bg-panel shadow-xl">
          {options.map((o, idx) => (
            <li key={idx} role="option" aria-selected={idx === i}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setI(idx)}
              className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${idx === i ? "bg-panel-2" : ""}`}>
              {o.kind === "node" ? (
                <>
                  <TypeIcon type={o.n.label} size={28} />
                  <span className="min-w-0 flex-1 truncate">{o.n.name}</span>
                  <span className="text-xs text-muted">{o.n.label}</span>
                </>
              ) : (
                <>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet/25 text-violet-soft"><Icon name="target" size={14} /></span>
                  <span className="min-w-0 flex-1 truncate">Analyze “{q.trim()}” as a change</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 rounded-full border border-line bg-panel/95 p-1.5 shadow-lg backdrop-blur">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-panel-2 text-muted"><Icon name="chat" size={18} /></span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setI(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={`Search an item or describe a change… (${hint} K)`}
          aria-label="Search the graph or describe a change"
          className="min-w-0 flex-1 bg-transparent px-1 text-sm text-text placeholder:text-muted focus:outline-none"
        />
        <button type="button" onClick={() => choose(options[i])} disabled={!options.length || busy}
          aria-label="Go" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet text-white disabled:bg-panel-2 disabled:text-muted">
          <Icon name="up" size={18} />
        </button>
      </div>
    </div>
  );
}
