"""Transaction CRUD — all queries scoped to the authenticated user."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import CategoryOut, TransactionCreate, TransactionOut, TransactionUpdate

router = APIRouter()


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories():
    """Public endpoint — no auth required."""
    res = supabase.table("categories").select("*").order("id").execute()
    return res.data or []


@router.get("", response_model=dict)
async def list_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: str | None = None,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    user_id: str = Depends(get_current_user_id),
):
    query = (
        supabase.table("transactions")
        .select("*, categories(id, name, name_en)", count="exact")
        .eq("user_id", user_id)
        .order("transaction_date", desc=True)
    )
    if category:
        # PostgREST embedded-resource filter syntax
        query = query.eq("category_id", f"{category}")
    if from_date:
        query = query.gte("transaction_date", from_date)
    if to_date:
        query = query.lte("transaction_date", to_date)

    start = (page - 1) * per_page
    query = query.range(start, start + per_page - 1)

    res = query.execute()
    total = res.count or 0
    return {
        "data": res.data,
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": (start + per_page) < total,
    }


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    body: TransactionCreate,
    user_id: str = Depends(get_current_user_id),
):
    payload = {**body.model_dump(), "user_id": user_id, "transaction_date": str(body.transaction_date)}
    res = supabase.table("transactions").insert(payload).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return res.data[0]


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    transaction_id: str,
    body: TransactionUpdate,
    user_id: str = Depends(get_current_user_id),
):
    _assert_owner("transactions", transaction_id, user_id)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = supabase.table("transactions").update(updates).eq("id", transaction_id).eq("user_id", user_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return res.data[0]


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: str,
    user_id: str = Depends(get_current_user_id),
):
    _assert_owner("transactions", transaction_id, user_id)
    supabase.table("transactions").delete().eq("id", transaction_id).eq("user_id", user_id).execute()


def _assert_owner(table: str, record_id: str, user_id: str) -> None:
    res = supabase.table(table).select("user_id").eq("id", record_id).single().execute()
    if not res.data or res.data["user_id"] != user_id:
        raise HTTPException(status_code=404, detail="Not found")
