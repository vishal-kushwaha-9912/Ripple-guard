# How RippleGuard works inside

This page follows **one request** from the click on "Analyze impact" to the report on screen.

## The big picture

```
Browser (React)  ──►  Backend (FastAPI)  ──►  Neo4j graph
 form, graph,          decides what to          stores dots and lines,
 report                ask and ranks answers    answers path questions
```

The backend is the middleman. The browser never talks to the database directly, so the database password stays on the server.

## One request, step by step

Example: you pick **Users API v1** and press **Analyze impact**.

1. **The browser sends a request** to `POST /api/changes/analyze` with the target, the change type and your description. (`frontend/src/services/api.js`)
2. **The backend finds the target.** If you picked it from the list, it checks that it exists. If you only typed a sentence, `change_parser.py` looks for a known name or path in the text, such as `/api/v1/auth/login`. If it cannot decide, it returns an error with suggestions instead of guessing.
3. **The backend asks the graph** for everything that depends on the target. In Neo4j this is a bounded Cypher query that follows lines *backwards* (from the thing being depended on, to the things that depend on it). Each result is a path such as `api-users → users-client → user-profile → dashboard-page`. (`database.py`)
4. **`impact_analyzer.py` turns paths into findings.** All paths that end at the same item are merged into one finding, which keeps its shortest path and a count of routes.
5. **It scores each finding** (table below).
6. **`report_generator.py` writes the report:** a summary sentence, the ordered findings, and a checklist.
7. **The report is saved** in the graph as a `ChangeEvent`, so it shows up under "Past analyses".
8. **The browser draws the result:** `ExplorerCanvas.jsx` lays the target in the centre, groups findings into rows by distance, colours each card by priority and draws the real relationships as curves. Hovering a card or clicking a finding highlights its path.

## How the priority score works

Every finding starts with points for distance, then rules add or remove points.

| Rule | Points |
|---|---|
| 1 step from the change | start at 4 |
| 2 steps | start at 3 |
| 3 steps or more | start at 2 (1 beyond 3) |
| Reached by more than one route | +1 |
| Marked as a critical component | +1 |
| Confirmed as affected in a past change | +1 |
| It is a document | −1 (docs rarely break running code) |

**4 or more = HIGH, 3 = MEDIUM, 2 or less = LOW.**

These are *review priorities*. They say "look here first", not "this will fail".

## Evidence quality

Every line in the graph records where it came from (`static-analysis`, `test-manifest`, `manual`...). If a line on the path has no source, the finding is marked "missing source evidence" so you know to double-check it.

## What is stored in Neo4j

**Project dots** (all also labelled `Entity`): Component, API, File, Dependency, Test, Document, Decision.

**Project lines:** CALLS, USES, IMPLEMENTS, TESTS, DOCUMENTS, DEPENDS_ON, CONFIGURES, REFERENCES. The line always points from the dependent thing to the thing it depends on. For example, `UsersClient -CALLS-> Users API`.

**Memory:**
```
(ChangeEvent) -[:TARGETS]->     (the changed item)
(ChangeEvent) -[:HAS_OUTCOME]-> (Outcome: confirmed yes/no + note)
```
When you press "Yes, it needed changes", an Outcome is saved. The next analysis finds it and adds a point.

## Safety choices

- Passwords live in `backend/.env` and are never sent to the browser.
- Queries use parameters, not text pasted from the user.
- Only the listed line types are followed, and depth is limited to 5 steps with a cap on results.
- The tool never edits or deploys your code.

## The backup graph

If `NEO4J_URI` is empty, or Neo4j cannot be reached, `MemoryStore` in `database.py` loads the same demo data into memory and answers the same questions. The top bar then says "In-memory fallback". This keeps a demo alive if the network fails, but for judging you should show it running on real Neo4j.

## Where to look when you want to change something

| I want to... | Open |
|---|---|
| Add or change demo data | `data/demo_project.json` |
| Change how priority is scored | `backend/app/services/impact_analyzer.py` |
| Change checklist wording | `backend/app/services/report_generator.py` |
| Change the Cypher query | `find_paths` in `backend/app/database.py` |
| Change colours or the look | `frontend/src/index.css` (theme colours) and `NodeCard.jsx` |
| Change how the map is laid out | `buildLayout` in `frontend/src/components/ExplorerCanvas.jsx` |
