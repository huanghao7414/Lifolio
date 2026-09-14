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
    trans_res = supabase.table("transactions").select("*").eq("user_id", user_id).gte("transaction_date", month_start).lte("transaction_date", str(today)).order("transaction_date", desc=True).execute()
    items_res = supabase.table("items").select("estimated_current_value").eq("user_id", user_id).execute()
    profile_res = supabase.table("user_profiles").select("monthly_budget").eq("id", user_id).single().execute()
    insights_res = supabase.table("ai_insights").select("id").eq("user_id", user_id).eq("is_read", False).execute()

    transactions = trans_res.data or []
    items = items_res.data or []
    profile = profile_res.data or {}
    unread_count = len(insights_res.data or [])

    monthly_spend = sum(float(t["amount"]) for t in transactions if t.get("transaction_type", "expense") == "expense")
    budget = float(profile.get("monthly_budget") or 0) or None
    total_assets = sum(float(i.get("estimated_current_value") or 0) for i in items)
    savings_rate = max(0, (budget - monthly_spend) / budget * 100) if budget else 0.0

    # Quick AI summary
    ai_summary = f"本月已支出 ¥{monthly_spend:.0f}，" + (f"预算剩余 ¥{budget - monthly_spend:.0f}。" if budget else "设置月预算可持续了解消费进度。")
    try:
        generated = await chat_completion(
            messages=[
                {"role": "user", "content": f"本月消费 ¥{monthly_spend:.0f}，预算 ¥{budget or '未设置'}。{_SUMMARY_PROMPT}"},
            ],
            temperature=0.7,
            user_id=user_id,
        )
        if generated.strip():
            ai_summary = generated
    except Exception:
        pass  # Core financial data remains usable without an available AI provider.

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
