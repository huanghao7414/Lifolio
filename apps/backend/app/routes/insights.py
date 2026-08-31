"""Insights, reports, and value scoring endpoints."""
from __future__ import annotations

from datetime import date, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import CategoryBreakdown, InsightReport, ValueScore
from app.services.insights_service import (
    compute_value_score,
    generate_monthly_summary,
    generate_score_suggestions,
)

router = APIRouter()


@router.get("/report", response_model=InsightReport)
async def get_report(
    period: str = Query("current_month", pattern="^(current_month|last_month)$"),
    user_id: str = Depends(get_current_user_id),
):
    today = date.today()
    if period == "current_month":
        start = today.replace(day=1)
        end = today
    else:
        first_of_current = today.replace(day=1)
        end = first_of_current - timedelta(days=1)
        start = end.replace(day=1)

    # Fetch transactions for the period
    res = supabase.table("transactions").select(
        "amount, transaction_type, categories(name, name_en)"
    ).eq("user_id", user_id).gte("transaction_date", str(start)).lte("transaction_date", str(end)).execute()

    transactions = res.data or []
    total_spend = sum(float(t["amount"]) for t in transactions if t.get("transaction_type", "expense") == "expense")
    total_income = sum(float(t["amount"]) for t in transactions if t.get("transaction_type") == "income")

    # Category breakdown (expenses only)
    cat_totals: dict[str, float] = defaultdict(float)
    cat_counts: dict[str, int] = defaultdict(int)
    for t in transactions:
        if t.get("transaction_type", "expense") != "expense":
            continue
        cat = t.get("categories", {}) or {}
        name = cat.get("name") or "其他"
        cat_totals[name] += float(t["amount"])
        cat_counts[name] += 1

    cats: list[CategoryBreakdown] = [
        CategoryBreakdown(
            category=k,
            amount=round(v, 2),
            percentage=round(v / total_spend * 100, 1) if total_spend else 0,
            count=cat_counts[k],
        )
        for k, v in sorted(cat_totals.items(), key=lambda x: -x[1])
    ]

    # Fetch user profile for budget + tone
    profile_res = supabase.table("user_profiles").select("monthly_budget, ai_tone").eq("id", user_id).single().execute()
    profile = profile_res.data or {}
    budget = float(profile.get("monthly_budget") or 0) or None
    tone = profile.get("ai_tone") or "casual"

    savings_rate = max(0, (budget - total_spend) / budget * 100) if budget else 0.0

    # Generate AI summary
    summary = await generate_monthly_summary(
        total_spend=total_spend,
        monthly_budget=budget,
        categories=[c.model_dump() for c in cats],
        savings_rate=savings_rate,
        tone=tone,
    )

    # Compute value score for the period
    items_res = supabase.table("items").select("usage_count").eq("user_id", user_id).execute()
    items = items_res.data or []
    total_items = len(items)
    unused_items = sum(1 for i in items if (i.get("usage_count") or 0) == 0)
    budget_used_pct = total_spend / budget * 100 if budget else 100.0
    score_obj = compute_value_score(savings_rate, budget_used_pct, [c.model_dump() for c in cats], unused_items, total_items)

    return InsightReport(
        period=period,
        period_start=str(start),
        period_end=str(end),
        total_spend=round(total_spend, 2),
        total_income=round(total_income, 2),
        net=round(total_income - total_spend, 2),
        savings_rate=round(savings_rate, 1),
        summary=summary,
        highlights=[f"{'·'.join(c.category for c in cats[:3])} 是本期主要消费类别"],
        categories_breakdown=cats,
        value_score=score_obj.score,
        suggestions=score_obj.suggestions,
    )


@router.get("/score", response_model=ValueScore)
async def get_value_score(user_id: str = Depends(get_current_user_id)):
    today = date.today()
    start = today.replace(day=1)

    trans_res = supabase.table("transactions").select(
        "amount, categories(name)"
    ).eq("user_id", user_id).gte("transaction_date", str(start)).execute()
    transactions = trans_res.data or []
    total_spend = sum(float(t["amount"]) for t in transactions)

    profile_res = supabase.table("user_profiles").select("monthly_budget").eq("id", user_id).single().execute()
    budget = float((profile_res.data or {}).get("monthly_budget") or 0) or None
    savings_rate = max(0, (budget - total_spend) / budget * 100) if budget else 0.0
    budget_used_pct = total_spend / budget * 100 if budget else 100.0

    cat_totals: dict[str, float] = defaultdict(float)
    for t in transactions:
        cat = (t.get("categories") or {}).get("name") or "其他"
        cat_totals[cat] += float(t["amount"])
    cats = [{"category": k, "amount": v, "percentage": v / total_spend * 100 if total_spend else 0, "count": 0} for k, v in cat_totals.items()]

    items_res = supabase.table("items").select("usage_count").eq("user_id", user_id).execute()
    items = items_res.data or []
    unused = sum(1 for i in items if (i.get("usage_count") or 0) == 0)

    score_obj = compute_value_score(savings_rate, budget_used_pct, cats, unused, len(items))
    suggestions = await generate_score_suggestions(
        score_obj.score, savings_rate, score_obj.breakdown.budget_adherence, score_obj.breakdown.asset_utilization
    )
    score_obj.suggestions = suggestions
    return score_obj


@router.get("", response_model=list[dict])
async def list_insights(
    insight_type: str | None = None,
    user_id: str = Depends(get_current_user_id),
):
    query = supabase.table("ai_insights").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(20)
    if insight_type:
        query = query.eq("insight_type", insight_type)
    res = query.execute()
    return res.data or []


@router.post("/{insight_id}/read", status_code=204)
async def mark_read(insight_id: str, user_id: str = Depends(get_current_user_id)):
    supabase.table("ai_insights").update({"is_read": True}).eq("id", insight_id).eq("user_id", user_id).execute()
