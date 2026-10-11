import uuid
from datetime import datetime, timezone

from ..schemas import Finding, Report

_CHECKS = {
    "Component": "Review {name}: confirm it still works with the changed {target}.",
    "File": "Open {name} and update any references to the changed {target}.",
    "Test": "Re-run {name}; update expectations if the {target} contract changed.",
    "Document": "Update {name} so it describes the new behaviour of {target}.",
    "Dependency": "Check {name} compatibility with the changed {target}.",
    "Decision": "Revisit the decision '{name}': it may no longer hold after changing {target}.",
    "API": "Check {name} for knock-on contract changes.",
}

_CHANGE_HINT = {
    "API_VERSION_CHANGE": "Look for hard-coded version strings and URLs.",
    "API_CONTRACT_CHANGE": "Look for code and assertions reading the old field names or shapes.",
    "ENDPOINT_REMOVAL": "Find every caller; each one needs a replacement or a fallback.",
    "DEPENDENCY_UPGRADE": "Check changelog for breaking changes and re-run the full suite.",
    "CONFIG_CHANGE": "Verify every environment (dev, staging, prod) carries the new value.",
    "GENERIC_CHANGE": "",
}


def build_report(*, project_id: str, target: dict, change_type: str, description: str,
                 parsed_from_text: bool, findings: list[Finding], backend: str) -> Report:
    counts = {p: sum(1 for f in findings if f.priority == p) for p in ("HIGH", "MEDIUM", "LOW")}
    name = target.get("name", target["id"])
    if findings:
        summary = (f"{len(findings)} connected {'entity' if len(findings) == 1 else 'entities'} may need review "
                   f"after changing {name}: {counts['HIGH']} high, {counts['MEDIUM']} medium, {counts['LOW']} low priority.")
    else:
        summary = f"No dependents were found for {name} within the searched depth. Absence of edges is not proof of safety."

    checklist = []
    for f in findings:
        text = _CHECKS.get(f.entity_type, "Review {name}.").format(name=f.name, target=name)
        checklist.append({"entity_id": f.entity_id, "priority": f.priority, "action": text,
                          "evidence_quality": f.evidence_quality})
    hint = _CHANGE_HINT.get(change_type, "")
    if hint:
        checklist.insert(0, {"entity_id": target["id"], "priority": "INFO", "action": hint,
                             "evidence_quality": "suggestion"})
    return Report(
        analysis_id=f"analysis-{uuid.uuid4().hex[:8]}",
        project_id=project_id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        target_id=target["id"], target_name=name, change_type=change_type,
        description=description, parsed_from_text=parsed_from_text,
        summary=summary, findings=findings, checklist=checklist, graph_backend=backend,
    )
