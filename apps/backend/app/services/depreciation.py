"""Item depreciation calculation and hold recommendation engine."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Literal

# Annual depreciation rates by category (straight-line default, can be overridden by AI)
_BASE_RATES: dict[str, float] = {
    "electronics": 0.30,   # 30% per year
    "clothing": 0.40,
    "furniture": 0.15,
    "vehicle": 0.20,
    "appliance": 0.20,
    "other": 0.25,
}

# After this many years the item has no salvage value (floor = 5% of purchase price)
_LIFETIME_YEARS: dict[str, int] = {
    "electronics": 5,
    "clothing": 3,
    "furniture": 15,
    "vehicle": 10,
    "appliance": 10,
    "other": 7,
}


def _daily_rate(annual_rate: float) -> float:
    return 1 - (1 - annual_rate) ** (1 / 365)


def calculate_current_value(
    purchase_price: float,
    purchase_date: date,
    category: str,
    custom_rate: float | None = None,
) -> float:
    """Declining-balance depreciation down to 5% floor."""
    rate = custom_rate if custom_rate is not None else _BASE_RATES.get(category, 0.25)
    days_held = (date.today() - purchase_date).days
    if days_held <= 0:
        return purchase_price
    daily = _daily_rate(rate)
    value = purchase_price * ((1 - daily) ** days_held)
    floor = purchase_price * 0.05
    return round(max(value, floor), 2)


def build_depreciation_timeline(
    purchase_price: float,
    purchase_date: date,
    category: str,
    custom_rate: float | None = None,
) -> list[dict]:
    """Monthly data points from purchase to today + 12 months forward."""
    rate = custom_rate if custom_rate is not None else _BASE_RATES.get(category, 0.25)
    lifetime = _LIFETIME_YEARS.get(category, 7)

    points: list[dict] = []
    # One point per month, from purchase through today + 12 months (or full lifetime)
    today = date.today()
    end = min(
        date(purchase_date.year + lifetime, purchase_date.month, purchase_date.day),
        today + timedelta(days=365),
    )

    current = purchase_date
    while current <= end:
        days = (current - purchase_date).days
        daily = _daily_rate(rate)
        value = purchase_price * ((1 - daily) ** days)
        floor = purchase_price * 0.05
        points.append({"date": current.isoformat(), "value": round(max(value, floor), 2)})
        # Advance one month
        month = current.month + 1
        year = current.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        try:
            current = date(year, month, current.day)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            current = date(year, month, last_day)

    return points


def get_hold_recommendation(
    purchase_price: float,
    current_value: float,
    usage_count: int,
    category: str,
) -> tuple[Literal["keep", "sell", "warning"], str]:
    """Return a hold recommendation and human-readable reason."""
    dep_pct = (purchase_price - current_value) / purchase_price * 100
    cost_per_use = current_value / usage_count if usage_count > 0 else None

    if dep_pct >= 80:
        return "sell", f"已折旧 {dep_pct:.0f}%，剩余价值有限，建议出售或处置。"

    if usage_count == 0:
        return "warning", "该物品从未使用，建议尽快使用或考虑出售。"

    if cost_per_use is not None and cost_per_use > purchase_price * 0.1:
        return "warning", f"每次使用成本 ¥{cost_per_use:.0f}，使用频率偏低，考虑出售回收价值。"

    if dep_pct < 30:
        return "keep", "物品保值良好，继续持有。"

    return "keep", f"折旧 {dep_pct:.0f}%，仍有使用价值，建议继续持有。"
