from fastapi import APIRouter

from ..database import get_store

router = APIRouter(prefix="/api")


@router.get("/graph")
def graph():
    return get_store().get_graph()
