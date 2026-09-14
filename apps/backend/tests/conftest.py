"""Offline test fixtures: never read .env or initialize a real database connection."""
from __future__ import annotations

import copy
import os
from pathlib import Path
import socket
import sys
from types import ModuleType, SimpleNamespace

import pytest
from pydantic_settings.sources import DotEnvSettingsSource

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
DotEnvSettingsSource._read_env_files = lambda self: {}
for name, value in {
    "SUPABASE_URL": "https://example.supabase.co",
    "SUPABASE_ANON_KEY": "fake-anon",
    "SUPABASE_SERVICE_ROLE_KEY": "fake-service-role",
    "SUPABASE_JWT_SECRET": "offline-test-jwt-secret",
    "LLM_KEY_ENCRYPTION_KEY": "offline-test-encryption-secret",
    "OPENAI_API_KEY": "",
    "OPENAI_BASE_URL": "https://api.openai.com/v1",
}.items():
    os.environ[name] = value

# This module is replaced before importing the app, so no real client is created.
fake_module = ModuleType("app.core.supabase_client")
fake_module.supabase = None
sys.modules["app.core.supabase_client"] = fake_module


class FakeDatabase:
    def __init__(self):
        self.rows = {name: [] for name in ("llm_configs", "conversations", "chat_messages", "transactions", "items", "user_profiles", "ai_insights")}
        self.calls = []
        self.counter = 0
        self.fail_table = None

    def table(self, name):
        return Query(self, name)


class Query:
    def __init__(self, db, table):
        self.db, self.name = db, table
        self.operation = "select"
        self.filters, self.ordering = [], []
        self.payload = None
        self.count = None
        self.bounds = None
        self.single_result = False

    def select(self, *args, **kwargs):
        return self

    def eq(self, key, value):
        self.filters.append((key, "eq", value))
        return self

    def gte(self, key, value):
        self.filters.append((key, "gte", value))
        return self

    def lte(self, key, value):
        self.filters.append((key, "lte", value))
        return self

    def order(self, key, desc=False):
        self.ordering.append((key, desc))
        return self

    def range(self, start, end):
        self.bounds = (start, end)
        return self

    def limit(self, count):
        self.count = count
        return self

    def maybe_single(self):
        self.single_result = True
        return self

    single = maybe_single

    def insert(self, payload):
        self.operation, self.payload = "insert", payload
        return self

    def update(self, payload):
        self.operation, self.payload = "update", payload
        return self

    def delete(self):
        self.operation = "delete"
        return self

    def execute(self):
        self.db.calls.append((self.name, self.operation, copy.deepcopy(self.filters), copy.deepcopy(self.payload)))
        if self.db.fail_table == self.name:
            raise RuntimeError("database error containing sk-secret and sensitive query contents")
        rows = self.db.rows[self.name]
        if self.operation == "insert":
            self.db.counter += 1
            now = f"2026-09-09T00:00:{self.db.counter:02d}Z"
            row = {"id": f"id-{self.db.counter}", "created_at": now, "updated_at": now, **self.payload}
            if self.name == "conversations":
                row = {"title": "新对话", "message_count": 0, "last_message_at": now, **row}
            if self.name == "chat_messages":
                row = {"sequence": self.db.counter, **row}
                for conv in self.db.rows["conversations"]:
                    if conv["id"] == row["conversation_id"] and conv["user_id"] == row["user_id"]:
                        conv["message_count"] += 1
                        conv["last_message_at"] = now
            rows.append(row)
            selected = [row]
        else:
            def matches(row):
                for key, op, value in self.filters:
                    actual = row.get(key)
                    if op == "eq" and actual != value:
                        return False
                    if op == "gte" and (actual is None or actual < value):
                        return False
                    if op == "lte" and (actual is None or actual > value):
                        return False
                return True
            selected = [row for row in rows if matches(row)]
            for key, desc in reversed(self.ordering):
                selected.sort(key=lambda row: row.get(key) or "", reverse=desc)
            if self.bounds:
                selected = selected[self.bounds[0]:self.bounds[1] + 1]
            if self.count is not None:
                selected = selected[:self.count]
            if self.operation == "update":
                for row in selected:
                    row.update(self.payload)
            if self.operation == "delete":
                self.db.rows[self.name] = [row for row in rows if row not in selected]
                if self.name == "conversations":
                    ids = {row["id"] for row in selected}
                    self.db.rows["chat_messages"] = [row for row in self.db.rows["chat_messages"] if row["conversation_id"] not in ids]
        data = selected[0] if self.single_result and selected else (None if self.single_result else selected)
        return SimpleNamespace(data=copy.deepcopy(data), count=len(selected))


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("Tests must never contact the network")
    monkeypatch.setattr(socket.socket, "connect", blocked)
    monkeypatch.setattr(socket.socket, "connect_ex", blocked)
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))])
    from app.core.config import settings
    from app.core import crypto
    monkeypatch.setattr(settings, "OPENAI_API_KEY", None)
    monkeypatch.setattr(crypto, "_fernet", None)


@pytest.fixture
def db(monkeypatch):
    from app.routes import settings, dashboard, insights, users
    from app.services import llm_service, conversation_service, admin_service
    database = FakeDatabase()
    for module in (settings, llm_service, conversation_service, dashboard, insights, users, admin_service):
        monkeypatch.setattr(module, "supabase", database)
    return database


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient
    from app.core.auth import get_current_user_id
    from main import app
    app.dependency_overrides[get_current_user_id] = lambda: "alice"
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def saved_config(db):
    from app.core.crypto import encrypt_secret, mask_secret
    row = {
        "id": "config-alice", "user_id": "alice", "provider": "openai",
        "base_url": "https://gateway.example.com/v1", "chat_model": "my-model",
        "vision_model": "my-vision", "temperature": 0, "is_enabled": True,
        "encrypted_api_key": encrypt_secret("sk-alice-private-key"),
        "key_hint": mask_secret("sk-alice-private-key"),
        "last_verified_at": "2026-09-08T00:00:00Z", "last_error": None,
        "updated_at": "2026-09-08T00:00:00Z",
    }
    db.rows["llm_configs"].append(row)
    return row
