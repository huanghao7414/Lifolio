"""User-owned profile and preferences."""
from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import ProfileUpdate

router = APIRouter()


@router.get("/profile")
async def get_profile(user_id: str = Depends(get_current_user_id)):
    res = supabase.table("user_profiles").select("*").eq("id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data


@router.patch("/profile")
async def update_profile(body: ProfileUpdate, user_id: str = Depends(get_current_user_id)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = supabase.table("user_profiles").update(updates).eq("id", user_id).execute()
    return res.data[0] if res.data else {}
