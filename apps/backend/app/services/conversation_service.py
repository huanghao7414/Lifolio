"""会话与消息的读写。

隔离策略（三层，缺一不可）：
  1. 表结构层：conversations / chat_messages 都有 user_id，外键 ON DELETE CASCADE
  2. 数据库层：RLS 策略 auth.uid() = user_id（chat_messages 冗余 user_id 以便直接判定）
  3. 应用层：本文件每一条语句都带 .eq("user_id", user_id)，
     因为后端用的是 service_role key，会绕过 RLS —— 应用层才是真正的兜底
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException

from app.core.supabase_client import supabase

logger = logging.getLogger(__name__)

_CONV = "conversations"
_MSG = "chat_messages"

DEFAULT_TITLE = "新对话"
MAX_CONTEXT_TURNS = 40  # 约 20 轮对话


def _first(res) -> dict | None:
    data = getattr(res, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data or None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── 会话 ────────────────────────────────────────────────────────────────────

def create_conversation(user_id: str, title: str | None = None) -> dict:
    payload = {
        "user_id": user_id,
        "title": (title or DEFAULT_TITLE).strip()[:200] or DEFAULT_TITLE,
    }
    res = supabase.table(_CONV).insert(payload).execute()
    row = _first(res)
    if not row:
        raise HTTPException(status_code=500, detail="创建会话失败")
    return row


def list_conversations(user_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    res = (
        supabase.table(_CONV)
        .select("*")
        .eq("user_id", user_id)
        .order("last_message_at", desc=True)
        .order("id", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return getattr(res, "data", None) or []


def get_conversation(user_id: str, conversation_id: str) -> dict:
    """按 user_id + id 双条件查询，查不到即 404（不泄露他人会话是否存在）。"""
    res = (
        supabase.table(_CONV)
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = _first(res)
    if not row:
        raise HTTPException(status_code=404, detail="会话不存在")
    return row


def delete_conversation(user_id: str, conversation_id: str) -> None:
    """删除自己的会话。消息由外键 ON DELETE CASCADE 级联清除。"""
    get_conversation(user_id, conversation_id)  # 先校验归属
    supabase.table(_CONV).delete().eq("id", conversation_id).eq("user_id", user_id).execute()


def rename_conversation(user_id: str, conversation_id: str, title: str) -> dict:
    get_conversation(user_id, conversation_id)
    res = (
        supabase.table(_CONV)
        .update({"title": title.strip()[:200], "updated_at": _now()})
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    return _first(res) or get_conversation(user_id, conversation_id)


# ─── 消息 ────────────────────────────────────────────────────────────────────

def list_messages(user_id: str, conversation_id: str, limit: int = 200) -> list[dict]:
    """Return the most recent bounded history in chronological order."""
    res = (
        supabase.table(_MSG)
        .select("*")
        .eq("conversation_id", conversation_id)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .order("sequence", desc=True)
        .limit(limit)
        .execute()
    )
    return list(reversed(getattr(res, "data", None) or []))


def append_message(
    user_id: str,
    conversation_id: str,
    role: str,
    content: str,
    model: str | None = None,
) -> dict:
    """追加一条消息。message_count / last_message_at 由数据库触发器维护。"""
    get_conversation(user_id, conversation_id)
    payload = {
        "conversation_id": conversation_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "model": model,
    }
    res = supabase.table(_MSG).insert(payload).execute()
    row = _first(res)
    if not row:
        raise HTTPException(status_code=503, detail="消息保存失败，请稍后重试")
    return row


def auto_title_from_first_message(user_id: str, conversation_id: str, content: str) -> None:
    """首条用户消息到达时，用它的前 20 字给会话起名。"""
    conv = get_conversation(user_id, conversation_id)
    if conv.get("title", DEFAULT_TITLE) != DEFAULT_TITLE:
        return
    snippet = " ".join(content.split())[:20]
    if not snippet:
        return
    supabase.table(_CONV).update(
        {"title": snippet, "updated_at": _now()}
    ).eq("id", conversation_id).eq("user_id", user_id).eq("title", DEFAULT_TITLE).execute()


def build_llm_context(
    user_id: str,
    conversation_id: str,
    max_turns: int = MAX_CONTEXT_TURNS,
) -> list[dict]:
    """从数据库重建上下文。

    特意不从请求体里拿历史 —— 服务端才是唯一事实来源，
    否则客户端可以伪造历史，而且容易重复拼接导致 token 翻倍。
    """
    rows = list_messages(user_id, conversation_id, limit=max_turns)
    return [
        {"role": r["role"], "content": r["content"]}
        for r in rows
        if r.get("role") in ("user", "assistant", "system")
    ]
