"""Graph stores. Neo4jStore is the real engine; MemoryStore is a local fallback
that exposes the same interface so the demo still runs without a database."""
from __future__ import annotations

import json
import threading
from collections import defaultdict
from typing import Optional

from .config import settings

REL_TYPES = ["CALLS", "USES", "IMPLEMENTS", "TESTS", "DOCUMENTS", "DEPENDS_ON", "CONFIGURES", "REFERENCES"]
NODE_LABELS = ["Project", "Component", "API", "File", "Dependency", "Test", "Document", "Decision"]


def _clean_paths(rows: list[dict], limit: int) -> list[dict]:
    """Drop paths that revisit a node (cycles) and cap the result."""
    out = []
    for r in rows:
        if len(set(r["ids"])) == len(r["ids"]):
            out.append(r)
        if len(out) >= limit:
            break
    return out


class MemoryStore:
    backend = "memory"

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.project: dict = {}
        self.nodes: dict[str, dict] = {}
        self.edges: list[dict] = []
        self.analyses: dict[str, dict] = {}
        self.outcomes: list[dict] = []

    def seed(self, data: dict) -> None:
        with self._lock:
            self.project = data["project"]
            self.nodes = {n["id"]: dict(n) for n in data["nodes"]}
            self.edges = [dict(e) for e in data["edges"]]

    def project_info(self) -> dict:
        return {**self.project, "node_count": len(self.nodes), "edge_count": len(self.edges)}

    def get_graph(self) -> dict:
        return {"nodes": list(self.nodes.values()), "edges": self.edges}

    def get_node(self, node_id: str) -> Optional[dict]:
        return self.nodes.get(node_id)

    def find_paths(self, target_id: str, max_depth: int, limit: int = 300) -> list[dict]:
        """All simple paths of dependents leading to the target (incoming edges)."""
        incoming: dict[str, list[dict]] = defaultdict(list)
        for e in self.edges:
            incoming[e["to"]].append(e)
        results: list[dict] = []

        def walk(node: str, ids: list[str], rels: list[str], srcs: list[str]) -> None:
            if len(rels) >= max_depth:
                return
            for e in incoming.get(node, []):
                if e["from"] in ids:
                    continue
                n_ids, n_rels, n_srcs = ids + [e["from"]], rels + [e["type"]], srcs + [e.get("source", "")]
                results.append({"ids": n_ids, "rels": n_rels, "sources": n_srcs})
                walk(e["from"], n_ids, n_rels, n_srcs)

        walk(target_id, [target_id], [], [])
        return results[:limit]

    def save_analysis(self, report: dict) -> None:
        self.analyses[report["analysis_id"]] = report

    def list_analyses(self) -> list[dict]:
        items = sorted(self.analyses.values(), key=lambda r: r["timestamp"], reverse=True)
        return [
            {k: r[k] for k in ("analysis_id", "timestamp", "target_id", "target_name", "change_type", "summary")}
            for r in items
        ]

    def get_analysis(self, analysis_id: str) -> Optional[dict]:
        return self.analyses.get(analysis_id)

    def add_outcome(self, analysis_id: str, entity_id: str, confirmed: bool, note: str, timestamp: str) -> None:
        self.outcomes.append(
            {"analysis_id": analysis_id, "entity_id": entity_id, "confirmed": confirmed, "note": note, "timestamp": timestamp}
        )

    def confirmed_outcomes(self, entity_id: str) -> list[dict]:
        return [o for o in self.outcomes if o["entity_id"] == entity_id and o["confirmed"]]


class Neo4jStore:
    backend = "neo4j"

    def __init__(self, uri: str, user: str, password: str) -> None:
        from neo4j import GraphDatabase

        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self.driver.verify_connectivity()
        self._project_id = "demo-project"

    def _run(self, query: str, **params) -> list[dict]:
        with self.driver.session() as session:
            return [r.data() for r in session.run(query, **params)]

    def close(self) -> None:
        self.driver.close()

    def seed(self, data: dict) -> None:
        pid = data["project"]["id"]
        self._project_id = pid
        self._run("CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE")
        self._run("CREATE CONSTRAINT change_event_id IF NOT EXISTS FOR (c:ChangeEvent) REQUIRE c.id IS UNIQUE")
        self._run("CREATE CONSTRAINT outcome_id IF NOT EXISTS FOR (o:Outcome) REQUIRE o.id IS UNIQUE")
        # Re-seeding replaces the project's entities but keeps recorded history.
        self._run("MATCH (e:Entity {project_id: $pid}) DETACH DELETE e", pid=pid)
        self._run(
            "MERGE (p:Project:Entity {id: $id}) SET p.name = $name, p.description = $desc, p.project_id = $id",
            id=pid, name=data["project"]["name"], desc=data["project"].get("description", ""),
        )
        for n in data["nodes"]:
            label = n["label"]
            if label not in NODE_LABELS:
                raise ValueError(f"Unsupported node label: {label}")
            props = {k: v for k, v in n.items() if k != "label"}
            props["project_id"] = pid
            self._run(f"MERGE (e:Entity:{label} {{id: $id}}) SET e += $props", id=n["id"], props=props)
        for e in data["edges"]:
            if e["type"] not in REL_TYPES:
                raise ValueError(f"Unsupported relationship type: {e['type']}")
            self._run(
                f"MATCH (a:Entity {{id: $a}}), (b:Entity {{id: $b}}) "
                f"MERGE (a)-[r:{e['type']}]->(b) SET r.source = $src",
                a=e["from"], b=e["to"], src=e.get("source", ""),
            )

    def project_info(self) -> dict:
        p = self._run("MATCH (p:Project {id: $id}) RETURN p.id AS id, p.name AS name, p.description AS description",
                      id=self._project_id)
        counts = self._run(
            "MATCH (n:Entity {project_id: $id}) WHERE NOT n:Project WITH count(n) AS nodes "
            "MATCH (:Entity {project_id: $id})-[r]->(:Entity {project_id: $id}) RETURN nodes, count(r) AS edges",
            id=self._project_id,
        )
        info = p[0] if p else {"id": self._project_id, "name": self._project_id, "description": ""}
        c = counts[0] if counts else {"nodes": 0, "edges": 0}
        return {**info, "node_count": c["nodes"], "edge_count": c["edges"]}

    def get_graph(self) -> dict:
        nodes = self._run(
            "MATCH (n:Entity {project_id: $id}) WHERE NOT n:Project "
            "RETURN properties(n) AS props, [l IN labels(n) WHERE l <> 'Entity'][0] AS label",
            id=self._project_id,
        )
        edges = self._run(
            "MATCH (a:Entity {project_id: $id})-[r]->(b:Entity {project_id: $id}) "
            "RETURN a.id AS `from`, b.id AS `to`, type(r) AS type, coalesce(r.source, '') AS source",
            id=self._project_id,
        )
        return {"nodes": [{**n["props"], "label": n["label"]} for n in nodes], "edges": edges}

    def get_node(self, node_id: str) -> Optional[dict]:
        rows = self._run(
            "MATCH (n:Entity {id: $id}) RETURN properties(n) AS props, [l IN labels(n) WHERE l <> 'Entity'][0] AS label",
            id=node_id,
        )
        return {**rows[0]["props"], "label": rows[0]["label"]} if rows else None

    def find_paths(self, target_id: str, max_depth: int, limit: int = 300) -> list[dict]:
        depth = int(max_depth)  # variable-length bounds cannot be parameters; value is validated as int
        types = "|".join(REL_TYPES)
        rows = self._run(
            f"MATCH p = (start:Entity {{id: $id}})<-[rels:{types}*1..{depth}]-(rel:Entity) "
            "RETURN [n IN nodes(p) | n.id] AS ids, [r IN relationships(p) | type(r)] AS rels, "
            "[r IN relationships(p) | coalesce(r.source, '')] AS sources LIMIT $limit",
            id=target_id, limit=limit * 3,
        )
        return _clean_paths(rows, limit)

    def save_analysis(self, report: dict) -> None:
        self._run(
            "MERGE (c:ChangeEvent {id: $id}) SET c.project_id = $pid, c.description = $desc, "
            "c.change_type = $ct, c.timestamp = $ts, c.target_id = $tid, c.report = $report "
            "WITH c MATCH (t:Entity {id: $tid}) MERGE (c)-[:TARGETS]->(t)",
            id=report["analysis_id"], pid=report["project_id"], desc=report["description"],
            ct=report["change_type"], ts=report["timestamp"], tid=report["target_id"],
            report=json.dumps(report),
        )

    def list_analyses(self) -> list[dict]:
        rows = self._run("MATCH (c:ChangeEvent) RETURN c.report AS report ORDER BY c.timestamp DESC LIMIT 25")
        out = []
        for r in rows:
            rep = json.loads(r["report"])
            out.append({k: rep[k] for k in ("analysis_id", "timestamp", "target_id", "target_name", "change_type", "summary")})
        return out

    def get_analysis(self, analysis_id: str) -> Optional[dict]:
        rows = self._run("MATCH (c:ChangeEvent {id: $id}) RETURN c.report AS report", id=analysis_id)
        return json.loads(rows[0]["report"]) if rows else None

    def add_outcome(self, analysis_id: str, entity_id: str, confirmed: bool, note: str, timestamp: str) -> None:
        self._run(
            "MATCH (c:ChangeEvent {id: $aid}) "
            "CREATE (o:Outcome {id: $oid, entity_id: $eid, confirmed: $conf, note: $note, timestamp: $ts}) "
            "CREATE (c)-[:HAS_OUTCOME]->(o)",
            aid=analysis_id, oid=f"{analysis_id}:{entity_id}:{timestamp}", eid=entity_id,
            conf=confirmed, note=note, ts=timestamp,
        )

    def confirmed_outcomes(self, entity_id: str) -> list[dict]:
        return self._run(
            "MATCH (o:Outcome {entity_id: $eid, confirmed: true}) "
            "RETURN o.note AS note, o.timestamp AS timestamp", eid=entity_id,
        )


_store = None
_init_error: Optional[str] = None


def get_store():
    global _store, _init_error
    if _store is not None:
        return _store
    from .services.graph_builder import load_demo

    if settings.neo4j_uri and not settings.force_memory_graph:
        try:
            candidate = Neo4jStore(settings.neo4j_uri, settings.neo4j_username, settings.neo4j_password)
            load_demo(candidate)
        except Exception as exc:  # unreachable DB, bad credentials, seed failure...
            _init_error = f"Neo4j unavailable ({type(exc).__name__}); using in-memory graph."
            candidate = MemoryStore()
            load_demo(candidate)
    else:
        candidate = MemoryStore()
        load_demo(candidate)
    _store = candidate  # only registered after a successful seed
    return _store


def init_error() -> Optional[str]:
    return _init_error


def set_store(store) -> None:
    """Used by tests."""
    global _store
    _store = store
