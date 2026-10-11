import { Icon, TypeIcon } from "./Icons.jsx";

export const CARD_W = 206;
export const CARD_H = 78;
export const CENTER_H = 150;

const RING = {
  HIGH: "var(--rg-ember)",
  MEDIUM: "var(--rg-sand)",
  LOW: "var(--rg-sky)",
};

export default function NodeCard({ node, pos, center, counts, finding, dim, onClick, onHover }) {
  const ring = finding ? RING[finding.priority] : null;
  const style = {
    left: pos.x - pos.w / 2,
    top: pos.y - pos.h / 2,
    width: pos.w,
    height: pos.h,
    opacity: dim ? 0.22 : 1,
    borderColor: center ? "var(--rg-violet)" : ring || "var(--rg-cardline)",
    boxShadow: center ? "0 0 0 3px color-mix(in srgb, var(--rg-violet) 30%, transparent), 0 8px 30px color-mix(in srgb, var(--rg-violet) 25%, transparent)" : ring ? `0 0 0 1px ${ring}` : "none",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={() => onHover?.(null)}
      title={node.name}
      aria-label={`${node.name}, ${node.label}${finding ? `, ${finding.priority.toLowerCase()} priority` : ""}`}
      className={`absolute rounded-xl border bg-card text-left transition-opacity ${center ? "p-2" : "px-3"} ${center ? "" : "hover:border-violet"}`}
      style={style}
    >
      {center ? (
        <div className="flex h-full flex-col justify-between">
          <span className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-500/25 py-1 text-xs font-medium text-sky">
            <Icon name="down" size={12} /> Consumes
            <span className="rounded-full bg-black/25 px-1.5">{counts.consumes}</span>
          </span>
          <div className="flex items-center gap-3 px-1">
            <TypeIcon type={node.label} size={40} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{node.name}</div>
              <div className="text-xs tracking-wide text-muted">{node.label.toUpperCase()}</div>
            </div>
          </div>
          <span className="flex items-center justify-center gap-1.5 rounded-lg bg-violet/30 py-1 text-xs font-medium text-violet-soft">
            <Icon name="up" size={12} /> Provides
            <span className="rounded-full bg-black/25 px-1.5">{counts.provides}</span>
          </span>
        </div>
      ) : (
        <div className="flex h-full items-center gap-3">
          <TypeIcon type={node.label} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{node.name}</div>
            <div className="text-xs tracking-wide text-muted">{node.label.toUpperCase()}</div>
          </div>
          {finding && (
            <span className="absolute right-2 top-2 rounded-full px-1.5 text-[10px] font-semibold"
              style={{ color: ring, background: `color-mix(in srgb, ${ring} 16%, transparent)` }}>
              {finding.priority.toLowerCase()}
            </span>
          )}
        </div>
      )}
    </button>
  );
}
