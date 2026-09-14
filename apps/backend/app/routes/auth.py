from fastapi import APIRouter, Depends
from app.core.auth import CurrentUser, get_current_user
from app.core.config import settings
from app.services.auth_service import authentication_config

router = APIRouter()


@router.get("/config")
async def config():
    return authentication_config()


@router.get("/me")
async def me(user: CurrentUser = Depends(get_current_user)):
    return {**user.model_dump(), "is_admin": user.id in settings.admin_user_ids}
