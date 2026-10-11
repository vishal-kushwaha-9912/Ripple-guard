from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import get_store
from .routes import changes, graph, projects

app = FastAPI(title="RippleGuard", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_methods=["*"], allow_headers=["*"])
app.include_router(projects.router)
app.include_router(graph.router)
app.include_router(changes.router)


@app.get("/health")
def health():
    store = get_store()
    return {"status": "ok", "graph_backend": store.backend}
