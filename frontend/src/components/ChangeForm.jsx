import { useEffect, useState } from "react";

const CHANGE_TYPES = [
  ["API_VERSION_CHANGE", "API version change"],
  ["API_CONTRACT_CHANGE", "Response or contract change"],
  ["ENDPOINT_REMOVAL", "Endpoint removal"],
  ["DEPENDENCY_UPGRADE", "Dependency upgrade"],
  ["CONFIG_CHANGE", "Configuration change"],
  ["GENERIC_CHANGE", "Other change"],
];

const EXAMPLES = [
  { label: "Users API v1 → v2", target_id: "api-users", change_type: "API_VERSION_CHANGE", description: "The users API will move from v1 to v2." },
  { label: "Login field renamed", target_id: "api-auth", change_type: "API_CONTRACT_CHANGE", description: "The login response now returns access_token instead of token." },
  { label: "Auth SDK upgrade", target_id: "sdk-auth", change_type: "DEPENDENCY_UPGRADE", description: "Upgrade the Authentication SDK from 2.1.0 to 3.0.0." },
];

export default function ChangeForm({ nodes, focusId, busy, onSubmit }) {
  const [form, setForm] = useState({ target_id: focusId, change_type: "API_VERSION_CHANGE", description: "", max_depth: 3 });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  useEffect(() => { set({ target_id: focusId }); }, [focusId]);

  const target = nodes.find((n) => n.id === form.target_id);
  const field = "w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-text placeholder:text-muted";

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button type="button" key={ex.label} onClick={() => set(ex)}
            className="rounded-full border border-line px-3 py-1 text-xs text-violet-soft hover:bg-panel-2">
            {ex.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted">
        What is changing: <span className="font-medium text-text">{target ? target.name : "pick an item on the map"}</span>
      </p>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Type of change</span>
        <select className={field} value={form.change_type} onChange={(e) => set({ change_type: e.target.value })}>
          {CHANGE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Describe the change</span>
        <textarea rows={3} className={field} value={form.description} onChange={(e) => set({ description: e.target.value })}
          placeholder="The login response now returns access_token instead of token." />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">How many steps away to look: {form.max_depth}</span>
        <input type="range" min="1" max="5" value={form.max_depth} onChange={(e) => set({ max_depth: Number(e.target.value) })} className="w-full accent-violet" />
      </label>

      <button type="submit" disabled={busy || !form.target_id}
        className="w-full rounded-lg bg-violet px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
        {busy ? "Analyzing…" : "Analyze impact"}
      </button>
    </form>
  );
}
