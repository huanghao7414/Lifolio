"""Receipt and product image analysis using GPT-4o Vision."""
from __future__ import annotations

import base64
import json

from app.models.schemas import ParseResult, ParsedTransaction, ParsedItem
from app.services.openai_service import vision_completion, parse_json_response

_RECEIPT_PROMPT = """\
This is a receipt image. Extract all line items and return ONLY valid JSON:
{
  "type": "transaction",
  "transactions": [
    {"amount": <total amount>, "category": "<category>", "description": "<store/merchant name>",
     "date": "<YYYY-MM-DD or null>", "is_split": false}
  ],
  "confidence": <0.0-1.0>
}
Categories: 餐饮|通勤|购物|娱乐|医疗|教育|其他
"""

_PRODUCT_PROMPT = """\
This is a product image. Identify the item and return ONLY valid JSON:
{
  "type": "item",
  "items": [
    {"name": "<product name>", "brand": "<brand or null>", "model": "<model or null>",
     "purchase_price": <estimated market price in CNY or null>,
     "category": "electronics|clothing|furniture|vehicle|appliance|other"}
  ],
  "confidence": <0.0-1.0>
}
"""


def _encode_image(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("utf-8")


async def analyze_receipt(image_bytes: bytes, user_id: str | None = None) -> ParseResult:
    b64 = _encode_image(image_bytes)
    raw = await vision_completion(b64, _RECEIPT_PROMPT, user_id=user_id)
    try:
        data = parse_json_response(raw)
        return ParseResult(
            type="transaction",
            transactions=[ParsedTransaction(**t) for t in data.get("transactions", [])],
            confidence=float(data.get("confidence", 0.7)),
        )
    except (json.JSONDecodeError, ValueError):
        return ParseResult(type="question", answer="Could not read receipt.", confidence=0.0)


async def analyze_product(image_bytes: bytes, user_id: str | None = None) -> ParseResult:
    b64 = _encode_image(image_bytes)
    raw = await vision_completion(b64, _PRODUCT_PROMPT, user_id=user_id)
    try:
        data = parse_json_response(raw)
        return ParseResult(
            type="item",
            items=[ParsedItem(**i) for i in data.get("items", [])],
            confidence=float(data.get("confidence", 0.7)),
        )
    except (json.JSONDecodeError, ValueError):
        return ParseResult(type="question", answer="Could not identify product.", confidence=0.0)


async def analyze_image(image_bytes: bytes, hint: str = "auto", user_id: str | None = None) -> ParseResult:
    """Route to receipt or product analyzer based on hint or content."""
    if hint == "receipt":
        return await analyze_receipt(image_bytes, user_id=user_id)
    if hint == "product":
        return await analyze_product(image_bytes, user_id=user_id)
    # Auto-detect: try receipt first (most common use case)
    result = await analyze_receipt(image_bytes, user_id=user_id)
    if result.confidence < 0.4:
        result = await analyze_product(image_bytes, user_id=user_id)
    return result
