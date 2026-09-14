"""会话历史 API。

所有接口都在路径与查询条件上双重绑定 user_id，
越权访问返回 404 而不是 403 —— 不泄露「该会话是否存在」。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.auth import get_current_user_id
from app.models.schemas import (
    ConversationCreate,
    ConversationDetail,
    ConversationOut,
    ConversationUpdate,
)
from app.services import conversation_service

router = APIRouter()


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user_id),
):
    """当前用户的会话列表，按最近活跃排序。"""
    rows = conversation_service.list_conversations(user_id, limit=limit, offset=offset)
    return [
        ConversationOut(
            id=r["id"],
            user_id=r["user_id"],
            title=r.get("title", "新对话"),
            message_count=r.get("message_count", 0),
            last_message_at=r.get("last_message_at", ""),
            created_at=r.get("created_at", ""),
            updated_at=r.get("updated_at", ""),
        )
        for r in rows
    ]


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate | None = None,
    user_id: str = Depends(get_current_user_id),
):
    """新建会话。前端首次发消息前先调它拿 conversation_id。"""
    row = conversation_service.create_conversation(
        user_id, body.title if body else None
    )
    return ConversationOut(
        id=row["id"],
        user_id=row["user_id"],
        title=row.get("title", "新对话"),
        message_count=row.get("message_count", 0),
        last_message_at=row.get("last_message_at", ""),
        created_at=row.get("created_at", ""),
        updated_at=row.get("updated_at", ""),
    )


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """读取单个会话及最近 200 条历史消息（按时间正序）。"""
    conv = conversation_service.get_conversation(user_id, conversation_id)
    rows = conversation_service.list_messages(user_id, conversation_id)
    return ConversationDetail(
        conversation=ConversationOut(
            id=conv["id"],
            user_id=conv["user_id"],
            title=conv.get("title", "新对话"),
            message_count=conv.get("message_count", 0),
            last_message_at=conv.get("last_message_at", ""),
            created_at=conv.get("created_at", ""),
            updated_at=conv.get("updated_at", ""),
        ),
        messages=[
            {
                "id": r["id"],
                "conversation_id": r["conversation_id"],
                "role": r["role"],
                "content": r["content"],
                "model": r.get("model"),
                "created_at": r.get("created_at", ""),
            }
            for r in rows
        ],
    )


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def rename_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    user_id: str = Depends(get_current_user_id),
):
    row = conversation_service.rename_conversation(user_id, conversation_id, body.title)
    return ConversationOut(
        id=row["id"],
        user_id=row["user_id"],
        title=row.get("title", "新对话"),
        message_count=row.get("message_count", 0),
        last_message_at=row.get("last_message_at", ""),
        created_at=row.get("created_at", ""),
        updated_at=row.get("updated_at", ""),
    )


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """删除会话，消息由外键级联清除。"""
    conversation_service.delete_conversation(user_id, conversation_id)
    return {"deleted": True, "id": conversation_id}
