"""Only the configured Supabase Auth verifies identities; client metadata is not trusted."""
from uuid import UUID
import httpx
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser(BaseModel):
    id: str
    email: str | None = None
    phone: str | None = None
    display_name: str | None = None
    providers: list[str] = []


async def verify_access_token(token: str) -> CurrentUser:
    # Supports both legacy HS256 and rotated/asymmetric signing keys through Auth.
    try:
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=False) as client:
            response = await client.get(
                f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user",
                headers={"apikey": settings.SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
            )
    except httpx.HTTPError:
        raise HTTPException(503, "登录验证服务暂不可用，请稍后重试") from None
    if response.status_code in (401, 403):
        raise HTTPException(401, "登录已失效，请重新登录", headers={"WWW-Authenticate": "Bearer"})
    if response.status_code != 200:
        raise HTTPException(503, "登录验证服务暂不可用，请稍后重试")
    try:
        data = response.json()
        user_id = str(UUID(data["id"]))
        providers = data.get("app_metadata", {}).get("providers", [])
        return CurrentUser(
            id=user_id, email=data.get("email") or None, phone=data.get("phone") or None,
            display_name=data.get("user_metadata", {}).get("display_name"),
            providers=[p for p in providers if isinstance(p, str)],
        )
    except (ValueError, KeyError, TypeError, AttributeError):
        raise HTTPException(503, "登录验证服务返回异常，请稍后重试") from None


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Security(bearer_scheme)) -> CurrentUser:
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(401, "请先登录", headers={"WWW-Authenticate": "Bearer"})
    return await verify_access_token(credentials.credentials)


async def get_current_user_id(user: CurrentUser = Depends(get_current_user)) -> str:
    return user.id


async def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.id not in settings.admin_user_ids:
        raise HTTPException(403, "当前账号没有后台管理权限")
    return user
