"""OpenAI client wrapper with streaming and structured output support."""
from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings

_client: AsyncOpenAI | None = None


def get_openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        kwargs: dict = {"api_key": settings.effective_api_key}
        if settings.LLM_BASE_URL:
            kwargs["base_url"] = settings.LLM_BASE_URL
        _client = AsyncOpenAI(**kwargs)
    return _client


async def chat_completion(
    messages: list[dict],
    model: str | None = None,
    response_format: dict | None = None,
    temperature: float = 0.3,
) -> str:
    """Single-shot chat completion, returns full text."""
    client = get_openai()
    kwargs: dict = {
        "model": model or settings.OPENAI_MODEL,
        "messages": messages,
        "temperature": temperature,
    }
    if response_format:
        kwargs["response_format"] = response_format

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


async def stream_chat_completion(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.7,
) -> AsyncGenerator[str, None]:
    """Yields text delta chunks for SSE streaming."""
    client = get_openai()
    stream = await client.chat.completions.create(
        model=model or settings.OPENAI_MODEL,
        messages=messages,
        temperature=temperature,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def vision_completion(
    image_b64: str,
    prompt: str,
    model: str | None = None,
) -> str:
    """Analyze a base64-encoded image with GPT-4o Vision."""
    client = get_openai()
    response = await client.chat.completions.create(
        model=model or settings.OPENAI_VISION_MODEL,
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


def parse_json_response(text: str) -> dict:
    """Strip markdown fences and parse JSON from a model response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    return json.loads(text)
