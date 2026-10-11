const P = {
  home: "M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  moon: "M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z",
  keyboard: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  target: "M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v3M12 19v3M2 12h3M19 12h3",
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M5 12l7 7 7-7",
  chat: "M4 5h16v11H9l-5 4z",
  copy: "M9 9h11v11H9zM5 15V4h11",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5",
  // type glyphs
  api: "M8 7l-4 5 4 5M16 7l4 5-4 5M13.5 5l-3 14",
  component: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5",
  file: "M7 3h7l5 5v13H7zM14 3v5h5",
  test: "M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3",
  document: "M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
  dependency: "M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8",
  decision: "M12 3l9 9-9 9-9-9z",
};

export function Icon({ name, size = 18, className = "" }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={P[name]} />
    </svg>
  );
}

const TYPES = {
  API: ["api", "#7c3aed", "#a78bfa"],
  Component: ["component", "#6d4df2", "#8b7bff"],
  File: ["file", "#4f6bf0", "#7c93ff"],
  Test: ["test", "#3b82f6", "#60a5fa"],
  Document: ["document", "#5b5bd6", "#8d8df0"],
  Dependency: ["dependency", "#7c4dff", "#b08cff"],
  Decision: ["decision", "#6366f1", "#818cf8"],
};

export function TypeIcon({ type, size = 40 }) {
  const [glyph, from, to] = TYPES[type] || TYPES.Component;
  return (
    <span
      className="grid shrink-0 place-items-center text-white"
      style={{ width: size, height: size, borderRadius: size * 0.28, background: `linear-gradient(145deg, ${from}, ${to})` }}
    >
      <Icon name={glyph} size={size * 0.5} />
    </span>
  );
}
