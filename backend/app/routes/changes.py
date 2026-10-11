from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from ..database import get_store
from ..schemas import AnalyzeRequest, OutcomeRequest
from ..services import change_parser, impact_analyzer, report_generator

router = APIRouter(prefix="/api/changes")


@router.post("/analyze")
def analyze(req: AnalyzeRequest):
    store = get_store()
    parsed = False
    if req.target_id:
        target = store.get_node(req.target_id)
        if not target:
            raise HTTPException(404, f"Entity '{req.target_id}' was not found in the graph.")
    else:
        if not req.description.strip():
            raise HTTPException(422, "Provide target_id or a description that names an entity.")
        target, candidates = change_parser.resolve_target(req.description, store.get_graph()["nodes"])
        if not target:
            names = [c["id"] for c in candidates[:5]]
            msg = "The description matches several entities; pick one." if names else \
                  "No known entity is mentioned in the description."
            raise HTTPException(422, {"message": msg, "candidates": names})
        parsed = True
    change_type = change_parser.normalise_change_type(req.change_type, req.description)
    findings = impact_analyzer.analyze(store, target["id"], req.max_depth)
    report = report_generator.build_report(
        project_id=req.project_id, target=target, change_type=change_type,
        description=req.description, parsed_from_text=parsed, findings=findings, backend=store.backend,
    ).model_dump()
    store.save_analysis(report)
    return report


@router.get("/history")
def history():
    return {"analyses": get_store().list_analyses()}


@router.get("/{analysis_id}")
def get_report(analysis_id: str):
    report = get_store().get_analysis(analysis_id)
    if not report:
        raise HTTPException(404, "Analysis not found.")
    return report


@router.post("/{analysis_id}/outcome")
def record_outcome(analysis_id: str, req: OutcomeRequest):
    store = get_store()
    report = store.get_analysis(analysis_id)
    if not report:
        raise HTTPException(404, "Analysis not found.")
    if req.entity_id not in {f["entity_id"] for f in report["findings"]}:
        raise HTTPException(422, "Entity is not part of this analysis.")
    store.add_outcome(analysis_id, req.entity_id, req.confirmed, req.note,
                      datetime.now(timezone.utc).isoformat())
    return {"ok": True}
