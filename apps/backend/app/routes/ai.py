"""AI routes: NLP parse, image vision, and streaming chat."""
from __future__ import annotations

import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from app.core.auth import get_current_user_id
from app.core.supabase_client import supabase
from app.models.schemas import ChatRequest, ParseRequest, ParseResult
from app.services import nlp_parser, vision_service
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
    return await nlp_parser.parse_input(body)


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
    return await vision_service.analyze_image(contents, hint)


@router.post("/chat")
async def chat(
    body: ChatRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Streaming AI chat via Server-Sent Events."""
    messages = [{"role": "system", "content": _CHAT_SYSTEM}] + [
        {"role": m.role, "content": m.content} for m in body.messages[-20:]
    ]

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            async for delta in stream_chat_completion(messages):
                payload = json.dumps({"content": delta}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
