"""Dashboard summary and user profile endpoints."""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import DashboardSummary, ProfileUpdate
from app.services.openai_service import chat_completion

router = APIRouter()

_SUMMARY_PROMPT = "用一句话（不超过40字）总结本月消费情况，语气亲切，不用markdown。"


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(user_id: str = Depends(get_current_user_id)):
    today = date.today()
    month_start = str(today.replace(day=1))

    # Parallel queries
    trans_res = supabase.table("transactions").select("*").eq("user_id", user_id).gte("transaction_date", month_start).order("transaction_date", desc=True).execute()
    items_res = supabase.table("items").select("estimated_current_value").eq("user_id", user_id).execute()
    profile_res = supabase.table("user_profiles").select("monthly_budget").eq("id", user_id).single().execute()
    insights_res = supabase.table("ai_insights").select("id").eq("user_id", user_id).eq("is_read", False).execute()

    transactions = trans_res.data or []
    items = items_res.data or []
    profile = profile_res.data or {}
    unread_count = len(insights_res.data or [])

    monthly_spend = sum(float(t["amount"]) for t in transactions)
    budget = float(profile.get("monthly_budget") or 0) or None
    total_assets = sum(float(i.get("estimated_current_value") or 0) for i in items)
    savings_rate = max(0, (budget - monthly_spend) / budget * 100) if budget else 0.0

    # Quick AI summary
    ai_summary = await chat_completion(
        messages=[
            {"role": "user", "content": f"本月消费 ¥{monthly_spend:.0f}，预算 ¥{budget or '未设置'}。{_SUMMARY_PROMPT}"},
        ],
        temperature=0.7,
    )

    return DashboardSummary(
        monthly_spend=round(monthly_spend, 2),
        monthly_budget=budget,
        budget_remaining=round(budget - monthly_spend, 2) if budget else None,
        budget_used_pct=round(monthly_spend / budget * 100, 1) if budget else None,
        total_assets_value=round(total_assets, 2),
        savings_rate=round(savings_rate, 1),
        ai_summary=ai_summary.strip(),
        recent_transactions=transactions[:5],
        unread_insight_count=unread_count,
    )


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
