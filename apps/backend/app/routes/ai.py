"""AI routes: NLP parse, image vision, and streaming chat (with persistence)."""
from __future__ import annotations

import json
from contextlib import aclosing
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.auth import get_current_user_id
from app.models.schemas import ChatRequest, ParseRequest, ParseResult
from app.services import (
    conversation_service,
    llm_service,
    nlp_parser,
    vision_service,
)
from app.services.openai_service import stream_chat_completion

router = APIRouter()

_CHAT_SYSTEM = """\
You are Lifolio's AI financial companion — warm, smart, and concise.
You help users understand their spending, track possessions, and improve financial well-being.
Respond in the same language the user uses (Chinese or English).
Keep responses under 150 words unless more detail is clearly needed.
When referencing amounts, use the user's currency (default CNY).
"""


@router.post("/parse", response_model=ParseResult)
async def parse_input(
    body: ParseRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Parse natural language into structured transaction or item data."""
    return await nlp_parser.parse_input(body, user_id=user_id)


@router.post("/vision", response_model=ParseResult)
async def analyze_image(
    file: UploadFile = File(...),
    hint: str = Form("auto"),
    user_id: str = Depends(get_current_user_id),
):
    """Analyze a receipt or product photo."""
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10 MB
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")
    return await vision_service.analyze_image(contents, hint, user_id=user_id)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Streaming AI chat via Server-Sent Events.

    持久化规则：
      * 传 conversation_id → 会话与消息落库。上下文**只从数据库重建**，
        请求体里只有最后一条用户消息会被采用，避免客户端伪造历史或重复拼接。
      * 不传 conversation_id → 一次性对话，不落库（用于快捷提问等场景）。
    """
    if not body.messages:
        raise HTTPException(status_code=400, detail="messages 不能为空")

    conversation_id = body.conversation_id
    new_user_content = body.messages[-1].content
    if conversation_id:
        # Resolve ownership before configuration to consistently hide other users' IDs.
        conversation_service.get_conversation(user_id, conversation_id)

    # 确认生效的模型（顺带在开流之前就把「未配置 Key」暴露成 400，而不是流到一半报错）
    try:
        config = llm_service.resolve_llm_config(user_id)
    except llm_service.LLMNotConfigured:
        raise HTTPException(
            status_code=400,
            detail="尚未配置 LLM：请在「设置 → AI」填入自己的 API Key，或联系管理员配置服务端 Key",
        )
    except llm_service.InvalidLLMConfig as exc:
        raise HTTPException(status_code=400, detail=llm_service.provider_error_message(exc)) from None

    if conversation_id:
        # 归属校验：不是自己的会话直接 404
        # 先取历史，再写入本次用户消息，保证顺序正确
        history = conversation_service.build_llm_context(user_id, conversation_id)
        conversation_service.append_message(
            user_id, conversation_id, "user", new_user_content
        )
        if not history:
            try:
                conversation_service.auto_title_from_first_message(
                    user_id, conversation_id, new_user_content
                )
            except Exception:
                pass  # A cosmetic title update must not abandon an accepted message.
    else:
        history = [
            {"role": m.role, "content": m.content} for m in body.messages[:-1]
        ]

    messages = [{"role": "system", "content": _CHAT_SYSTEM}]
    messages += history
    messages += [{"role": "user", "content": new_user_content}]

    async def event_stream() -> AsyncGenerator[str, None]:
        chunks: list[str] = []
        try:
            async with aclosing(stream_chat_completion(messages, user_id=user_id, config=config)) as stream:
                async for delta in stream:
                    chunks.append(delta)
                    payload = json.dumps({"content": delta}, ensure_ascii=False)
                    yield f"data: {payload}\n\n"
        except Exception as exc:
            # 出错时把用户消息留在库里，便于排查上下文
            yield f"data: {json.dumps({'error': llm_service.provider_error_message(exc)}, ensure_ascii=False)}\n\n"
        else:
            full = "".join(chunks)
            if conversation_id and full.strip():
                try:
                    conversation_service.append_message(
                        user_id, conversation_id, "assistant", full, model=config.chat_model
                    )
                except Exception:  # 落库失败不能影响已经吐出去的流
                    yield f"data: {json.dumps({'warning': 'AI 回复未保存到历史记录，请保留当前内容后重试'}, ensure_ascii=False)}\n\n"
        # Never yield from finally: closing/cancelling an async generator must not emit.
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "X-Conversation-Id": conversation_id or "",
        },
    )
