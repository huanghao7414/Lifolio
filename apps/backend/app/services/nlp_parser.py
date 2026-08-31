"""Natural language → structured transaction / item parser."""
from __future__ import annotations

import json
from datetime import date

from app.models.schemas import ParseRequest, ParseResult, ParsedTransaction, ParsedItem
from app.services.openai_service import chat_completion, parse_json_response

_SYSTEM_PROMPT = """\
You are a bilingual (Chinese/English) financial assistant for the Lifolio app.
Parse the user's natural language input and return ONLY valid JSON matching this schema:

{
  "type": "transaction" | "item" | "mixed" | "question",
  "transactions": [
    {
      "amount": <positive number>,
      "category": "餐饮" | "通勤" | "购物" | "娱乐" | "医疗" | "教育" | "其他",
      "description": "<short description>",
      "date": "<YYYY-MM-DD or null>",
      "is_split": <bool>,
      "split_count": <int or null>
    }
  ],
  "items": [
    {
      "name": "<item name>",
      "brand": "<brand or null>",
      "model": "<model or null>",
      "purchase_price": <number or null>,
      "category": "electronics" | "clothing" | "furniture" | "vehicle" | "appliance" | "other"
    }
  ],
  "answer": "<string, only if type is question>",
  "confidence": <0.0-1.0>
}

Rules:
- If the input is a spending/expense statement, set type="transaction".
- If it describes a purchased physical item, set type="item".
- If it includes both, set type="mixed".
- If it's a question (e.g. "how much did I spend?"), set type="question" and fill "answer" with a helpful placeholder.
- "is_split" is true when the user mentions AA制, splitting, or Dutch treat.
- For dates, infer from context (today, yesterday) or leave null.
- NEVER include explanatory text outside the JSON object.
"""


async def parse_input(req: ParseRequest) -> ParseResult:
    today = date.today().isoformat()
    user_message = f"Today is {today}.\n\nUser input: {req.input}"

    raw = await chat_completion(
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )

    try:
        data = parse_json_response(raw)
    except (json.JSONDecodeError, ValueError):
        return ParseResult(type="question", answer="Sorry, I couldn't parse that.", confidence=0.0)

    return ParseResult(
        type=data.get("type", "question"),
        transactions=[ParsedTransaction(**t) for t in data.get("transactions", [])],
        items=[ParsedItem(**i) for i in data.get("items", [])],
        answer=data.get("answer"),
        confidence=float(data.get("confidence", 0.8)),
    )
