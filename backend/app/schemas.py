from typing import Optional

from pydantic import BaseModel, Field

CHANGE_TYPES = [
    "API_VERSION_CHANGE",
    "API_CONTRACT_CHANGE",
    "ENDPOINT_REMOVAL",
    "DEPENDENCY_UPGRADE",
    "CONFIG_CHANGE",
    "GENERIC_CHANGE",
]


class AnalyzeRequest(BaseModel):
    project_id: str = "demo-project"
    target_id: Optional[str] = None
    change_type: Optional[str] = None
    description: str = Field(default="", max_length=2000)
    max_depth: int = Field(default=3, ge=1, le=5)


class OutcomeRequest(BaseModel):
    entity_id: str
    confirmed: bool
    note: str = Field(default="", max_length=500)


class Finding(BaseModel):
    entity_id: str
    entity_type: str
    name: str
    priority: str
    score: int
    depth: int
    reason: str
    path_count: int
    paths: list[list[str]]
    path_relationships: list[list[str]]
    evidence_quality: str  # "sourced" | "uncertain"
    history: list[str] = []


class Report(BaseModel):
    analysis_id: str
    project_id: str
    timestamp: str
    target_id: str
    target_name: str
    change_type: str
    description: str
    parsed_from_text: bool
    summary: str
    findings: list[Finding]
    checklist: list[dict]
    graph_backend: str
