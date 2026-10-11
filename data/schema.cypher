// Run once in Neo4j Browser / Aura Query (the backend also does this automatically on seed).
CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (e:Entity) REQUIRE e.id IS UNIQUE;
CREATE CONSTRAINT change_event_id IF NOT EXISTS FOR (c:ChangeEvent) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT outcome_id IF NOT EXISTS FOR (o:Outcome) REQUIRE o.id IS UNIQUE;

// Direct dependents of an API
MATCH (n:Entity)-[r]->(api:API {id: $api_id})
RETURN labels(n) AS types, n.id AS id, type(r) AS relationship;

// Multi-hop (bounded) dependents with their evidence path
MATCH p = (start:Entity {id: $api_id})<-[rels:CALLS|USES|IMPLEMENTS|TESTS|DOCUMENTS|DEPENDS_ON|CONFIGURES|REFERENCES*1..3]-(related:Entity)
RETURN [n IN nodes(p) | n.id] AS ids, [r IN relationships(p) | type(r)] AS rels
LIMIT 200;
