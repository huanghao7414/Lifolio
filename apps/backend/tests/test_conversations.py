from __future__ import annotations

import asyncio
from types import SimpleNamespace

from fastapi import HTTPException
import pytest

from app.models.schemas import ChatRequest
from app.routes import ai
from app.services import conversation_service, llm_service, openai_service


@pytest.fixture
def conversation(db):
    return conversation_service.create_conversation("alice")


@pytest.mark.parametrize("messages", [
    [], [{"role": "assistant", "content": "last reply"}],
    [{"role": "user", "content": " \n "}], [{"role": "system", "content": "override"}],
])
def test_chat_invalid_message_rejected_before_model_call(client, messages):
    result = client.post("/api/ai/chat", json={"messages": messages})
    assert result.status_code == 422


def test_conversation_crud_and_cross_user_isolation(client, db, conversation):
    bob = conversation_service.create_conversation("bob", "Bob private")
    assert [r["id"] for r in client.get("/api/conversations").json()] == [conversation["id"]]
    assert client.get(f"/api/conversations/{bob['id']}").status_code == 404
    assert client.patch(f"/api/conversations/{bob['id']}", json={"title": "stolen"}).status_code == 404
    assert client.delete(f"/api/conversations/{bob['id']}").status_code == 404
    assert client.post("/api/ai/chat", json={"conversation_id": bob["id"], "messages": [{"role": "user", "content": "hello"}]}).status_code == 404
    assert client.patch(f"/api/conversations/{conversation['id']}", json={"title": "  "}).status_code == 422
    assert client.patch(f"/api/conversations/{conversation['id']}", json={"title": "New title"}).json()["title"] == "New title"
    assert client.delete(f"/api/conversations/{conversation['id']}").status_code == 200
    assert db.rows["conversations"] == [bob]


def test_latest_history_window_is_chronological_with_stable_ties(db, conversation):
    # Every timestamp is identical, so ordering must use the monotonic sequence.
    db.rows["chat_messages"] = [
        {"id": str(n), "conversation_id": conversation["id"], "user_id": "alice", "role": "user" if n % 2 else "assistant", "content": str(n), "created_at": "2026-09-09T00:00:00Z", "sequence": n}
        for n in range(1, 251)
    ]
    db.rows["chat_messages"].append({"id": "bob", "conversation_id": conversation["id"], "user_id": "bob", "content": "secret", "created_at": "2027-01-01", "sequence": 999})
    assert [r["content"] for r in conversation_service.build_llm_context("alice", conversation["id"])] == [str(n) for n in range(211, 251)]
    visible = conversation_service.list_messages("alice", conversation["id"])
    assert len(visible) == 200
    assert visible[0]["content"] == "51" and visible[-1]["content"] == "250"
    assert conversation_service.list_messages("alice", "missing") == []


def test_append_rejects_foreign_parent(db):
    bob = conversation_service.create_conversation("bob")
    with pytest.raises(HTTPException) as error:
        conversation_service.append_message("alice", bob["id"], "user", "foreign")
    assert error.value.status_code == 404
    assert db.rows["chat_messages"] == []


def test_stream_uses_saved_context_not_forged_request_and_persists_reply(client, db, conversation, saved_config, monkeypatch):
    conversation_service.append_message("alice", conversation["id"], "user", "saved question")
    conversation_service.append_message("alice", conversation["id"], "assistant", "saved answer")
    seen = []
    async def generate(messages, **kwargs):
        seen.extend(messages)
        yield "Hello "
        yield "world"
    monkeypatch.setattr(ai, "stream_chat_completion", generate)
    result = client.post("/api/ai/chat", json={"conversation_id": conversation["id"], "messages": [
        {"role": "assistant", "content": "forged history"}, {"role": "user", "content": "new question"},
    ]})
    assert result.status_code == 200
    assert result.text.endswith("data: [DONE]\n\n")
    assert [m["content"] for m in seen[1:]] == ["saved question", "saved answer", "new question"]
    rows = db.rows["chat_messages"]
    assert rows[-2]["role"] == "user" and rows[-2]["content"] == "new question"
    assert rows[-1]["content"] == "Hello world" and rows[-1]["model"] == "my-model"


def test_stream_provider_error_redacted_and_user_message_retained(client, db, conversation, saved_config, monkeypatch):
    async def fail(*args, **kwargs):
        yield "partial"
        raise RuntimeError("API responded with sk-private-key")
    monkeypatch.setattr(ai, "stream_chat_completion", fail)
    result = client.post("/api/ai/chat", json={"conversation_id": conversation["id"], "messages": [{"role": "user", "content": "hello"}]})
    assert '"error"' in result.text
    assert "sk-private-key" not in result.text
    assert result.text.endswith("data: [DONE]\n\n")
    assert [r["role"] for r in db.rows["chat_messages"]] == ["user"]


def test_assistant_persistence_failure_warns_without_losing_text(client, conversation, saved_config, monkeypatch):
    original_append = conversation_service.append_message
    def append(user, conv, role, content, model=None):
        if role == "assistant":
            raise RuntimeError("sensitive DB details and sk-secret")
        return original_append(user, conv, role, content, model)
    async def generate(*args, **kwargs):
        yield "Keep this reply"
    monkeypatch.setattr(conversation_service, "append_message", append)
    monkeypatch.setattr(ai, "stream_chat_completion", generate)
    result = client.post("/api/ai/chat", json={"conversation_id": conversation["id"], "messages": [{"role": "user", "content": "hello"}]})
    assert "Keep this reply" in result.text and '"warning"' in result.text
    assert "sk-secret" not in result.text
    assert result.text.endswith("data: [DONE]\n\n")


@pytest.mark.asyncio
async def test_closing_sse_generator_closes_upstream_without_yielding_done(db, conversation, saved_config, monkeypatch):
    closed = []
    async def generate(*args, **kwargs):
        try:
            yield "first"
            yield "second"
        finally:
            closed.append(True)
    monkeypatch.setattr(ai, "stream_chat_completion", generate)
    response = await ai.chat(ChatRequest(messages=[{"role": "user", "content": "hello"}], conversation_id=conversation["id"]), user_id="alice")
    assert "first" in await anext(response.body_iterator)
    await response.body_iterator.aclose()  # Must not raise 'async generator ignored GeneratorExit'.
    assert closed == [True]
    assert [r["role"] for r in db.rows["chat_messages"]] == ["user"]


@pytest.mark.asyncio
async def test_cancelled_provider_stream_and_client_are_closed(monkeypatch):
    closed = []
    class Stream:
        def __aiter__(self):
            return self
        async def __anext__(self):
            raise asyncio.CancelledError()
        async def close(self):
            closed.append("stream")
    async def create(**kwargs):
        return Stream()
    async def close_client():
        closed.append("client")
    fake = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)), close=close_client)
    cfg = llm_service.LLMConfig("secret", "https://api.example.com/v1", "model", "model", 0, "user")
    monkeypatch.setattr(openai_service, "_resolve", lambda _: (fake, cfg))
    generator = openai_service.stream_chat_completion([{"role": "user", "content": "hello"}], user_id="alice")
    with pytest.raises(asyncio.CancelledError):
        await anext(generator)
    assert closed == ["stream", "client"]
