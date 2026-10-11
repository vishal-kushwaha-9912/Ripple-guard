import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.database import MemoryStore, set_store
from app.main import app
from app.services import change_parser, graph_builder, impact_analyzer

DATA = Path(__file__).resolve().parents[2] / "data" / "demo_project.json"


@pytest.fixture()
def store():
    s = MemoryStore()
    graph_builder.load_demo(s, str(DATA))
    set_store(s)
    return s


def by_id(findings):
    return {f.entity_id: f for f in findings}


def test_demo_graph_is_clean():
    assert graph_builder.validate(json.loads(DATA.read_text())) == []


def test_direct_dependents_found(store):
    f = by_id(impact_analyzer.analyze(store, "api-users", 1))
    assert set(f) == {"users-client", "users-integration-test", "users-api-guide"}


def test_multi_hop_path_discovered(store):
    f = by_id(impact_analyzer.analyze(store, "api-users", 3))
    assert f["dashboard-page"].depth == 3
    assert f["dashboard-page"].paths[0] == ["api-users", "users-client", "user-profile", "dashboard-page"]


def test_unrelated_component_not_reported(store):
    f = by_id(impact_analyzer.analyze(store, "api-users", 5))
    assert "billing-page" not in f and "billing-test" not in f


def test_priorities(store):
    f = by_id(impact_analyzer.analyze(store, "api-users", 3))
    assert f["users-integration-test"].priority == "HIGH"
    assert f["users-api-guide"].priority == "MEDIUM"  # documents are downgraded one level


def test_every_path_is_a_real_edge(store):
    edges = {(e["from"], e["type"], e["to"]) for e in store.edges}
    for f in impact_analyzer.analyze(store, "api-auth", 4):
        for ids, rels in zip(f.paths, f.path_relationships):
            for i, rel in enumerate(rels):
                assert (ids[i + 1], rel, ids[i]) in edges


def test_removed_relationship_removes_path(store):
    store.edges = [e for e in store.edges if not (e["from"] == "users-integration-test")]
    assert "users-integration-test" not in by_id(impact_analyzer.analyze(store, "api-users", 3))


def test_multiple_paths_are_merged(store):
    f = by_id(impact_analyzer.analyze(store, "api-auth", 3))
    assert f["dashboard-page"].path_count == 1
    store.edges.append({"from": "dashboard-page", "type": "CALLS", "to": "api-auth", "source": "manual"})
    f = by_id(impact_analyzer.analyze(store, "api-auth", 3))
    assert f["dashboard-page"].path_count == 2


def test_confirmed_history_raises_priority(store):
    before = by_id(impact_analyzer.analyze(store, "api-users", 3))["user-list"].score
    store.add_outcome("a1", "user-list", True, "Needed new field", "2026-01-01T00:00:00Z")
    after = by_id(impact_analyzer.analyze(store, "api-users", 3))["user-list"]
    assert after.score == before + 1 and after.history


def test_parser():
    assert change_parser.detect_change_type("The login response field is renamed") == "API_CONTRACT_CHANGE"
    assert change_parser.detect_change_type("We are removing the endpoint") == "ENDPOINT_REMOVAL"


def test_api_flow(store):
    c = TestClient(app)
    assert c.get("/health").json()["status"] == "ok"
    r = c.post("/api/changes/analyze", json={"target_id": "api-users", "description": "move v1 to v2"})
    assert r.status_code == 200 and len(r.json()["findings"]) >= 3
    aid = r.json()["analysis_id"]
    assert c.get(f"/api/changes/{aid}").status_code == 200
    assert c.get("/api/changes/history").json()["analyses"][0]["analysis_id"] == aid
    assert c.post("/api/changes/analyze", json={"target_id": "nope"}).status_code == 404
    r = c.post("/api/changes/analyze", json={"description": "The /api/v1/auth/login response now returns access_token"})
    assert r.status_code == 200 and r.json()["target_id"] == "api-auth" and r.json()["parsed_from_text"]
    ok = c.post(f"/api/changes/{aid}/outcome", json={"entity_id": "user-list", "confirmed": True, "note": "x"})
    assert ok.status_code == 200
