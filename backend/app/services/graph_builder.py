"""Loads and validates the project graph definition."""
import json
from pathlib import Path

from ..config import settings
from ..database import NODE_LABELS, REL_TYPES


def validate(data: dict) -> list[str]:
    """Return a list of data-quality problems (empty list = clean)."""
    problems: list[str] = []
    ids: set[str] = set()
    for n in data["nodes"]:
        if n["id"] in ids:
            problems.append(f"duplicate node id: {n['id']}")
        ids.add(n["id"])
        if n["label"] not in NODE_LABELS:
            problems.append(f"unknown label {n['label']} on {n['id']}")
    seen: set[tuple] = set()
    for e in data["edges"]:
        key = (e["from"], e["type"], e["to"])
        if key in seen:
            problems.append(f"duplicate edge: {key}")
        seen.add(key)
        if e["type"] not in REL_TYPES:
            problems.append(f"unknown relationship type {e['type']}")
        for end in (e["from"], e["to"]):
            if end not in ids:
                problems.append(f"edge references missing node: {end}")
        if not e.get("source"):
            problems.append(f"edge without source evidence: {key}")
    return problems


def load_demo(store, path: str | None = None) -> dict:
    data = json.loads(Path(path or settings.demo_data_path).read_text(encoding="utf-8"))
    problems = validate(data)
    if problems:
        raise ValueError("Invalid demo graph: " + "; ".join(problems))
    store.seed(data)
    return data
