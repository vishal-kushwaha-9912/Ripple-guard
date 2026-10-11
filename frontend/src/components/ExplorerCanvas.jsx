import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import NodeCard, { CARD_H, CARD_W, CENTER_H } from "./NodeCard.jsx";

const COLS = 4;
const GX = 34;
const GY = 58;
const GY_IN = 22;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function edgePath(a, b) {
  // path runs from `a` (the dependent) to `b` (what it depends on)
  const aBelow = a.y > b.y;
  const x1 = a.x, y1 = aBelow ? a.y - a.h / 2 : a.y + a.h / 2;
  const x2 = b.x, y2 = aBelow ? b.y + b.h / 2 : b.y - b.h / 2;
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

export function buildLayout(graph, focusId, report, show) {
  const consumesIds = [...new Set(graph.edges.filter((e) => e.from === focusId).map((e) => e.to))];
  const providesIds = [...new Set(graph.edges.filter((e) => e.to === focusId).map((e) => e.from))];
  const inReport = !!report && report.target_id === focusId;

  const seen = new Set([focusId]);
  const take = (ids) => ids.filter((id) => !seen.has(id) && seen.add(id));

  const aboveGroups = show.consumes ? [{ rows: chunk(take(consumesIds), COLS) }] : [];
  let belowGroups = [];
  if (show.provides) {
    if (inReport) {
      const depths = [...new Set(report.findings.map((f) => f.depth))].sort((a, b) => a - b);
      belowGroups = depths.map((d) => ({
        label: `${d} ${d === 1 ? "step" : "steps"} away`,
        rows: chunk(take(report.findings.filter((f) => f.depth === d).map((f) => f.entity_id)), COLS),
      }));
    } else {
      belowGroups = [{ rows: chunk(take(providesIds), COLS) }];
    }
  }

  const pos = { [focusId]: { x: 0, y: 0, w: CARD_W, h: CENTER_H } };
  const labels = [];
  const place = (groups, startY, dir) => {
    let y = startY;
    groups.forEach((group, gi) => {
      group.rows.forEach((row, ri) => {
        row.forEach((id, j) => {
          pos[id] = { x: (j - (row.length - 1) / 2) * (CARD_W + GX), y, w: CARD_W, h: CARD_H };
        });
        if (ri === 0 && group.label) {
          labels.push({ text: group.label, x: -((row.length - 1) / 2) * (CARD_W + GX) - CARD_W / 2, y: y - CARD_H / 2 - 22 });
        }
        const lastInGroup = ri === group.rows.length - 1;
        y += dir * (CARD_H + (lastInGroup ? GY : GY_IN));
      });
    });
  };
  place(aboveGroups, -(CENTER_H / 2 + GY + CARD_H / 2), -1);
  place(belowGroups, CENTER_H / 2 + GY + CARD_H / 2, 1);

  const edges = graph.edges.filter((e) => {
    const a = pos[e.from], b = pos[e.to];
    if (!a || !b || a.y === b.y) return false;
    return e.from === focusId || e.to === focusId || Math.sign(a.y) === Math.sign(b.y);
  });

  const consumes = consumesIds.length;
  const provides = providesIds.length;
  const key = `${focusId}|${Object.keys(pos).length}|${inReport ? report.analysis_id : ""}`;
  return { pos, edges, labels, counts: { consumes, provides }, key, inReport };
}

export default function ExplorerCanvas({ graph, focusId, report, show, selectedId, fitSignal, onFocus }) {
  const box = useRef(null);
  const moved = useRef(false);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [hoverId, setHoverId] = useState(null);

  const nodeIndex = useMemo(() => Object.fromEntries(graph.nodes.map((n) => [n.id, n])), [graph]);
  const layout = useMemo(() => buildLayout(graph, focusId, report, show), [graph, focusId, report, show]);

  const fit = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const ps = Object.values(layout.pos);
    const minX = Math.min(...ps.map((p) => p.x - p.w / 2)), maxX = Math.max(...ps.map((p) => p.x + p.w / 2));
    const minY = Math.min(...ps.map((p) => p.y - p.h / 2)), maxY = Math.max(...ps.map((p) => p.y + p.h / 2));
    const cw = el.clientWidth, ch = el.clientHeight;
    const k = clamp(Math.min((cw - 100) / (maxX - minX), (ch - 220) / (maxY - minY)), 0.35, 1);
    setView({ k, x: cw / 2 - ((minX + maxX) / 2) * k, y: ch / 2 - 20 - ((minY + maxY) / 2) * k });
  }, [layout]);

  useEffect(() => { fit(); }, [layout.key, fitSignal, show]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = box.current;
    const ro = new ResizeObserver(() => fit());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    const el = box.current;
    const onWheel = (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left, py = e.clientY - r.top;
      setView((v) => {
        const k = clamp(v.k * (e.deltaY < 0 ? 1.1 : 0.9), 0.25, 2);
        const s = k / v.k;
        return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    moved.current = false;
    const move = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
      if (moved.current) setView((v) => ({ ...v, x: start.vx + dx, y: start.vy + dy }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // highlight the path of the hovered / selected finding
  const activeId = selectedId || hoverId;
  const active = layout.inReport && activeId ? report.findings.find((f) => f.entity_id === activeId) : null;
  const pathNodes = new Set(), pathEdges = new Set();
  if (active) {
    active.paths.forEach((ids) => {
      ids.forEach((id) => pathNodes.add(id));
      ids.slice(0, -1).forEach((_, i) => pathEdges.add(`${ids[i + 1]}|${ids[i]}`));
    });
  }
  const findingOf = (id) => (layout.inReport ? report.findings.find((f) => f.entity_id === id) : null);

  return (
    <div ref={box} className="canvas-bg absolute inset-0 overflow-hidden" onPointerDown={onPointerDown}
      role="application" aria-label="Dependency explorer. Drag to pan, scroll to zoom.">
      <div style={{ position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} width="1" height="1">
          <defs>
            <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--rg-edge)" }} />
            </marker>
            <marker id="ah-focus" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" style={{ fill: "var(--rg-violet-soft)" }} />
            </marker>
          </defs>
          {layout.edges.map((e) => {
            const k = `${e.from}|${e.to}`;
            const isFocus = pathEdges.has(k);
            return (
              <path key={k} d={edgePath(layout.pos[e.from], layout.pos[e.to])}
                className={`edge ${isFocus ? "focus" : active ? "dim" : ""}`}
                markerEnd={`url(#${isFocus ? "ah-focus" : "ah"})`} />
            );
          })}
        </svg>

        {layout.labels.map((l) => (
          <div key={l.text} className="pointer-events-none absolute text-xs text-muted" style={{ left: l.x, top: l.y }}>{l.text}</div>
        ))}

        {Object.entries(layout.pos).map(([id, p]) => (
          <NodeCard key={id} node={nodeIndex[id]} pos={p} center={id === focusId} counts={layout.counts}
            finding={findingOf(id)} dim={active ? !pathNodes.has(id) : false}
            onHover={setHoverId}
            onClick={() => { if (!moved.current && id !== focusId) onFocus(id); }} />
        ))}
      </div>
    </div>
  );
}
