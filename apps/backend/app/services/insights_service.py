"""AI-generated life insights, monthly reports, and value scoring."""
from __future__ import annotations

from datetime import date
from collections import defaultdict

from app.models.schemas import InsightReport, ValueScore, ValueScoreBreakdown, CategoryBreakdown
from app.services.openai_service import chat_completion

_REPORT_SYSTEM = """\
You are Lifolio's AI financial companion. Generate a warm, friendly monthly spending report in Simplified Chinese.
Respond with a concise paragraph (3–5 sentences) as if you're a trusted friend reviewing the user's finances.
Keep the tone: {tone}. Do NOT use markdown.
"""

_SCORE_SYSTEM = """\
You are Lifolio's AI. Based on the user's financial data, give 2-3 actionable improvement suggestions in Simplified Chinese.
Each suggestion should be practical and under 30 characters. Return a JSON array of strings, no markdown.
"""


async def generate_monthly_summary(
    total_spend: float,
    monthly_budget: float | None,
    categories: list[dict],
    savings_rate: float,
    tone: str = "casual",
) -> str:
    category_text = "\n".join(
        f"- {c['category']}: ¥{c['amount']:.0f} ({c['percentage']:.0f}%)" for c in categories
    )
    user_msg = (
        f"本月消费总额: ¥{total_spend:.0f}\n"
        f"月预算: {'¥' + str(monthly_budget) if monthly_budget else '未设置'}\n"
        f"储蓄率: {savings_rate:.0f}%\n"
        f"消费分类:\n{category_text}"
    )
    system = _REPORT_SYSTEM.format(tone=tone)
    return await chat_completion(
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
        temperature=0.7,
    )


async def generate_score_suggestions(
    score: float,
    savings_rate: float,
    budget_adherence: float,
    asset_utilization: float,
) -> list[str]:
    user_msg = (
        f"生活价值评分: {score:.0f}/100\n"
        f"储蓄率: {savings_rate:.0f}%\n"
        f"预算执行率: {budget_adherence:.0f}%\n"
        f"资产利用率: {asset_utilization:.0f}%"
    )
    raw = await chat_completion(
        messages=[
            {"role": "system", "content": _SCORE_SYSTEM},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        temperature=0.5,
    )
    import json
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return data
        return data.get("suggestions", [])
    except Exception:
        return ["增加储蓄比例", "控制非必要消费", "提高物品使用频率"]


def compute_value_score(
    savings_rate: float,        # 0-100
    budget_used_pct: float,     # 0-100+
    categories: list[dict],     # for diversity score
    unused_items_count: int,
    total_items_count: int,
) -> ValueScore:
    """Deterministic scoring formula (0-100)."""
    # Savings score: 0% → 0, 30%+ → 100
    savings_score = min(savings_rate / 30 * 100, 100)

    # Budget adherence: under budget → 100, over by 20%+ → 0
    if budget_used_pct <= 100:
        budget_score = 100.0
    else:
        overage = budget_used_pct - 100
        budget_score = max(0, 100 - overage * 5)

    # Spend diversity: 5+ categories → 100
    active_cats = len([c for c in categories if c["amount"] > 0])
    diversity_score = min(active_cats / 5 * 100, 100)

    # Asset utilization: no unused items → 100
    if total_items_count == 0:
        util_score = 100.0
    else:
        util_score = (1 - unused_items_count / total_items_count) * 100

    # Weighted average
    score = (
        savings_score * 0.35
        + budget_score * 0.30
        + diversity_score * 0.15
        + util_score * 0.20
    )

    return ValueScore(
        score=round(score, 1),
        breakdown=ValueScoreBreakdown(
            savings_rate=round(savings_score, 1),
            spend_diversity=round(diversity_score, 1),
            asset_utilization=round(util_score, 1),
            budget_adherence=round(budget_score, 1),
        ),
        suggestions=[],
        trend="stable",
    )
