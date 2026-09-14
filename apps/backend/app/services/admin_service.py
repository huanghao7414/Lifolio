"""Read-only operational overview. No financial records, chat content or keys."""
import asyncio
from datetime import datetime, timedelta, timezone
from time import monotonic
from app.core.config import settings
from app.core.supabase_client import supabase
from app.services.auth_service import authentication_config
from app.services.monitoring_service import metrics

TABLES = {"users": "user_profiles", "transactions": "transactions", "items": "items",
          "conversations": "conversations", "messages": "chat_messages", "ai_configs": "llm_configs"}


def count_rows(table, since=None):
    query = supabase.table(table).select("id", count="exact", head=True)
    if since:
        query = query.gte("created_at", since)
    return query.execute().count


async def database_probe():
    start = monotonic()
    try:
        await asyncio.wait_for(asyncio.to_thread(count_rows, "user_profiles"), timeout=5)
        return {"status": "ok", "latency_ms": round((monotonic() - start) * 1000, 1)}
    except Exception:
        return {"status": "unavailable", "latency_ms": None}


async def overview():
    async def safe_count(table, since=None):
        try:
            return await asyncio.wait_for(asyncio.to_thread(count_rows, table, since), timeout=5)
        except Exception:
            return None

    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    values = await asyncio.gather(*(safe_count(table) for table in TABLES.values()), safe_count("user_profiles", since))
    totals = dict(zip([*TABLES, "new_users_7d"], values))
    try:
        result = await asyncio.wait_for(asyncio.to_thread(
            lambda: supabase.table("user_profiles").select("id,display_name,created_at").order("created_at", desc=True).limit(10).execute()
        ), timeout=5)
        recent = [{key: row.get(key) for key in ("id", "display_name", "created_at")} for row in (result.data or [])]
    except Exception:
        recent = []
    healthy = all(value is not None for value in values)
    return {
        "checked_at": datetime.now(timezone.utc).isoformat(), "version": "1.0.0",
        "status": "ok" if healthy else "degraded",
        "totals": totals, "recent_users": recent, "metrics": metrics.snapshot(),
        "services": [
            {"name": "API", "status": "ok", "detail": "当前进程正在提供服务"},
            {"name": "数据库", "status": "ok" if healthy else "degraded", "detail": "已检查业务表；不可用的计数显示为未知"},
            {"name": "平台 AI", "status": "configured" if settings.OPENAI_API_KEY else "not_configured", "detail": "仅显示平台配置状态，不调用模型；用户可使用自有配置"},
        ],
        "authentication": authentication_config(),
    }
