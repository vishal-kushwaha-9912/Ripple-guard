"""Deterministic change interpretation. No LLM needed; an LLM can be plugged in
later but must still resolve to a real graph node before analysis."""
import re
from typing import Optional

from ..schemas import CHANGE_TYPES

_RULES = [
    ("ENDPOINT_REMOVAL", r"\b(remov\w*|delet\w*|deprecat\w*|retir\w*|sunset\w*|drop\w*)\b"),
    ("API_VERSION_CHANGE", r"\b(v\d+\b.*\bv\d+|version|migrat\w*|upgrade to v)\b"),
    ("API_CONTRACT_CHANGE", r"\b(field|renam\w*|response|schema|payload|contract|returns?|format)\b"),
    ("DEPENDENCY_UPGRADE", r"\b(sdk|library|package|dependency|bump\w*|upgrad\w*)\b"),
    ("CONFIG_CHANGE", r"\b(config\w*|env\w*|setting|flag|url)\b"),
]


def detect_change_type(text: str) -> str:
    low = text.lower()
    for change_type, pattern in _RULES:
        if re.search(pattern, low):
            return change_type
    return "GENERIC_CHANGE"


def resolve_target(text: str, nodes: list[dict]) -> tuple[Optional[dict], list[dict]]:
    """Match free text against node ids, names, paths and titles.
    Returns (best match or None if ambiguous/none, ranked candidates)."""
    low = text.lower()
    scored: list[tuple[int, dict]] = []
    for n in nodes:
        score = 0
        for key in ("id", "name", "path", "title"):
            value = str(n.get(key, "")).lower()
            if value and value in low:
                score = max(score, len(value) + (50 if key == "id" else 0))
        if score:
            scored.append((score, n))
    scored.sort(key=lambda s: s[0], reverse=True)
    candidates = [n for _, n in scored]
    if not scored:
        return None, []
    if len(scored) > 1 and scored[0][0] == scored[1][0]:
        return None, candidates
    return scored[0][1], candidates


def normalise_change_type(value: Optional[str], description: str) -> str:
    if value and value in CHANGE_TYPES:
        return value
    return detect_change_type(description)
