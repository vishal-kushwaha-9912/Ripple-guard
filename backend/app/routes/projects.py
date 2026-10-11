from fastapi import APIRouter

from ..database import get_store, init_error

router = APIRouter(prefix="/api")


@router.get("/projects")
def list_projects():
    store = get_store()
    return {"projects": [store.project_info()], "graph_backend": store.backend, "warning": init_error()}
