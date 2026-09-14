"""LLM 调用封装：流式输出、结构化输出、视觉理解。

所有入口都接受 user_id，由 llm_service 决定用「用户自配」还是「服务端兜底」。
未传 user_id 时走全局配置，仅供内部任务（如定时报告）使用。
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator

from app.core.config import settings
from app.services.llm_service import (
    LLMConfig, LLMNotConfigured, InvalidLLMConfig, get_llm_client,
    _global_config, create_llm_client, provider_error_message,
)

logger = logging.getLogger(__name__)


def _resolve(user_id: str | None):
    """返回 (client, config)。用户未配置且服务端无兜底时抛 LLMNotConfigured。"""
    if user_id:
        return get_llm_client(user_id)
    cfg = _global_config()
    return create_llm_client(cfg), cfg


async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    response_format: dict | None = None,
    temperature: float | None = None,
    user_id: str | None = None,
) -> str:
    """Single-shot chat completion, returns full text."""
    client, cfg = _resolve(user_id)
    kwargs: dict = {
        "model": model or cfg.chat_model,
        "messages": messages,
        "temperature": cfg.temperature if temperature is None else temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format

    try:
        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message.content or ""
    except Exception as exc:
        raise InvalidLLMConfig(provider_error_message(exc)) from None
    finally:
        await client.close()


async def stream_chat_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float | None = None,
    user_id: str | None = None,
    config: LLMConfig | None = None,
) -> AsyncGenerator[str, None]:
    """Yields text delta chunks for SSE streaming."""
    client, cfg = (create_llm_client(config), config) if config else _resolve(user_id)
    stream = None
    try:
        stream = await client.chat.completions.create(
            model=model or cfg.chat_model,
            messages=messages,
            temperature=cfg.temperature if temperature is None else temperature,
            stream=True,
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    except Exception as exc:
        raise InvalidLLMConfig(provider_error_message(exc)) from None
    finally:
        try:
            if stream is not None:
                await stream.close()
        finally:
            await client.close()


async def vision_completion(
    image_b64: str,
    prompt: str,
    model: str | None = None,
    user_id: str | None = None,
) -> str:
    """Analyze a base64-encoded image with a vision-capable model."""
    client, cfg = _resolve(user_id)
    try:
        response = await client.chat.completions.create(
            model=model or cfg.vision_model or cfg.chat_model,
            messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
                    },
                ],
            }
            ],
            temperature=0.2,
            max_tokens=1500,
        )
        return response.choices[0].message.content or ""
    except Exception as exc:
        raise InvalidLLMConfig(provider_error_message(exc)) from None
    finally:
        await client.close()


def parse_json_response(text: str) -> dict:
    """Strip markdown fences and parse JSON from a model response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    return json.loads(text)


__all__ = [
    "chat_completion",
    "stream_chat_completion",
    "vision_completion",
    "parse_json_response",
    "LLMConfig",
    "LLMNotConfigured",
]
