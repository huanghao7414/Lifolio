from fastapi import APIRouter, Depends
from app.core.auth import require_admin
from app.services.admin_service import overview

router = APIRouter(dependencies=[Depends(require_admin)])


@router.get("/overview")
async def get_overview():
    return await overview()
