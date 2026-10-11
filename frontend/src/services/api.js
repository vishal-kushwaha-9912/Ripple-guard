const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the RippleGuard backend. Start it with: uvicorn app.main:app --reload");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = body.detail;
    const msg = typeof detail === "string" ? detail : detail?.message || "Request failed";
    const extra = detail?.candidates?.length ? ` Candidates: ${detail.candidates.join(", ")}.` : "";
    throw new Error(msg + extra);
  }
  return body;
}

export const api = {
  projects: () => request("/api/projects"),
  graph: () => request("/api/graph"),
  history: () => request("/api/changes/history"),
  report: (id) => request(`/api/changes/${id}`),
  analyze: (payload) => request("/api/changes/analyze", { method: "POST", body: JSON.stringify(payload) }),
  outcome: (id, payload) => request(`/api/changes/${id}/outcome`, { method: "POST", body: JSON.stringify(payload) }),
};
