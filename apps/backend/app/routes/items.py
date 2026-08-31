"""Item CRUD + depreciation endpoint."""
from __future__ import annotations

import io
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import (
    DepreciationData,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    ItemUsageCreate,
    DepreciationPoint,
)
from app.services import depreciation as dep_svc

router = APIRouter()


@router.get("", response_model=list[ItemOut])
async def list_items(user_id: str = Depends(get_current_user_id)):
    res = supabase.table("items").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data


@router.get("/{item_id}", response_model=ItemOut)
async def get_item(item_id: str, user_id: str = Depends(get_current_user_id)):
    item = _get_item_or_404(item_id, user_id)
    return item


@router.post("", response_model=ItemOut, status_code=201)
async def create_item(body: ItemCreate, user_id: str = Depends(get_current_user_id)):
    payload = {**body.model_dump(), "user_id": user_id, "purchase_date": str(body.purchase_date)}
    res = supabase.table("items").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return res.data[0]


@router.patch("/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: str,
    body: ItemUpdate,
    user_id: str = Depends(get_current_user_id),
):
    _get_item_or_404(item_id, user_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = supabase.table("items").update(updates).eq("id", item_id).execute()
    return res.data[0]


@router.delete("/{item_id}", status_code=204)
async def delete_item(item_id: str, user_id: str = Depends(get_current_user_id)):
    _get_item_or_404(item_id, user_id)
    supabase.table("items").delete().eq("id", item_id).execute()


@router.post("/{item_id}/usage", status_code=201)
async def log_usage(
    item_id: str,
    body: ItemUsageCreate,
    user_id: str = Depends(get_current_user_id),
):
    _get_item_or_404(item_id, user_id)
    supabase.table("item_usages").insert(
        {**body.model_dump(), "item_id": item_id, "user_id": user_id}
    ).execute()
    # Increment usage count on item
    item = _get_item_or_404(item_id, user_id)
    new_count = (item.get("usage_count") or 0) + 1
    new_hours = (item.get("total_usage_hours") or 0.0) + (body.duration_hours or 0)
    supabase.table("items").update(
        {"usage_count": new_count, "total_usage_hours": new_hours}
    ).eq("id", item_id).execute()
    return {"status": "logged"}


@router.get("/{item_id}/depreciation", response_model=DepreciationData)
async def get_depreciation(item_id: str, user_id: str = Depends(get_current_user_id)):
    from datetime import date

    item = _get_item_or_404(item_id, user_id)
    purchase_date = date.fromisoformat(str(item["purchase_date"]))
    category = item.get("category", "other")
    price = float(item["purchase_price"])
    usage_count = item.get("usage_count") or 0
    custom_rate = item.get("depreciation_rate")

    current_value = dep_svc.calculate_current_value(price, purchase_date, category, custom_rate)
    timeline_raw = dep_svc.build_depreciation_timeline(price, purchase_date, category, custom_rate)
    rec, reason = dep_svc.get_hold_recommendation(price, current_value, usage_count, category)

    dep_pct = (price - current_value) / price * 100
    cost_per_use = current_value / usage_count if usage_count > 0 else None

    # Persist updated valuation
    supabase.table("items").update(
        {
            "estimated_current_value": current_value,
            "ai_hold_recommendation": rec,
            "last_valued_at": "now()",
        }
    ).eq("id", item_id).execute()

    return DepreciationData(
        item_id=item_id,
        purchase_price=price,
        current_value=current_value,
        depreciation_percentage=round(dep_pct, 1),
        cost_per_use=round(cost_per_use, 2) if cost_per_use else None,
        hold_recommendation=rec,
        hold_reason=reason,
        timeline=[DepreciationPoint(**p) for p in timeline_raw],
    )


@router.post("/{item_id}/image")
async def upload_item_image(
    item_id: str,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    _get_item_or_404(item_id, user_id)
    contents = await file.read()
    path = f"items/{user_id}/{item_id}.jpg"
    supabase.storage.from_("item-images").upload(path, contents, {"content-type": file.content_type or "image/jpeg"})
    url = supabase.storage.from_("item-images").get_public_url(path)
    supabase.table("items").update({"image_url": url}).eq("id", item_id).execute()
    return {"image_url": url}


def _get_item_or_404(item_id: str, user_id: str) -> dict:
    res = supabase.table("items").select("*").eq("id", item_id).eq("user_id", user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Item not found")
    return res.data
