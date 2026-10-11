"""Turns raw graph paths into prioritised, explainable findings."""
from ..schemas import Finding

_BASE_BY_DEPTH = {1: 4, 2: 3, 3: 2}


def _priority(score: int) -> str:
    return "HIGH" if score >= 4 else "MEDIUM" if score == 3 else "LOW"


def analyze(store, target_id: str, max_depth: int = 3) -> list[Finding]:
    paths = store.find_paths(target_id, max_depth)
    by_entity: dict[str, list[dict]] = {}
    for p in paths:
        by_entity.setdefault(p["ids"][-1], []).append(p)

    findings: list[Finding] = []
    for entity_id, entity_paths in by_entity.items():
        node = store.get_node(entity_id) or {"label": "Unknown", "name": entity_id}
        entity_paths.sort(key=lambda p: len(p["rels"]))
        shortest = entity_paths[0]
        depth = len(shortest["rels"])

        score = _BASE_BY_DEPTH.get(depth, 1)
        notes = []
        if len(entity_paths) > 1:
            score += 1
            notes.append(f"{len(entity_paths)} independent paths")
        if node.get("critical"):
            score += 1
            notes.append("critical component")
        if node.get("label") == "Document":
            score -= 1
        history = [
            o.get("note") or "Previously confirmed as affected by a similar change"
            for o in store.confirmed_outcomes(entity_id)
        ]
        if history:
            score += 1
            notes.append("confirmed in a previous change")
        sourced = all(all(s for s in p["sources"]) for p in entity_paths)

        # reason: walk the shortest path from dependent to target
        ids, rels = shortest["ids"], shortest["rels"]
        steps = []
        for i, rel in enumerate(rels):
            a = (store.get_node(ids[i + 1]) or {}).get("name", ids[i + 1])
            b = (store.get_node(ids[i]) or {}).get("name", ids[i])
            steps.append(f"{a} {rel.replace('_', ' ').lower()} {b}")
        reason = "; ".join(steps) + "."
        if notes:
            reason += f" Raised by: {', '.join(notes)}."

        findings.append(
            Finding(
                entity_id=entity_id,
                entity_type=node.get("label", "Unknown"),
                name=node.get("name", entity_id),
                priority=_priority(score),
                score=score,
                depth=depth,
                reason=reason,
                path_count=len(entity_paths),
                paths=[p["ids"] for p in entity_paths],
                path_relationships=[p["rels"] for p in entity_paths],
                evidence_quality="sourced" if sourced else "uncertain",
                history=history,
            )
        )
    order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    findings.sort(key=lambda f: (order[f.priority], f.depth, f.name))
    return findings
