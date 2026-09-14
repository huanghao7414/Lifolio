from __future__ import annotations

import copy
import socket
from types import SimpleNamespace

import httpx
import pytest
from openai import AuthenticationError

from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.services import llm_service


class ProbeClient:
    def __init__(self, failure=None):
        self.calls = []
        self.failure = failure
        self.closed = False
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        if self.failure:
            raise self.failure
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="OK"))])

    async def close(self):
        self.closed = True


def probe(monkeypatch, failure=None):
    client = ProbeClient(failure)
    configs = []
    def create(cfg):
        configs.append(cfg)
        return client
    monkeypatch.setattr(llm_service, "create_llm_client", create)
    return client, configs


def test_unconfigured_and_global_sources(client, monkeypatch):
    assert client.get("/api/settings/llm").json()["source"] == "unconfigured"
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-server-secret")
    data = client.get("/api/settings/llm").json()
    assert data["source"] == "global"
    assert not data["has_key"]
    assert "sk-server-secret" not in str(data)


def test_same_provider_does_not_reset_saved_url_models_or_zero_temperature(client, saved_config):
    result = client.put("/api/settings/llm", json={"provider": "openai"})
    assert result.status_code == 200
    assert result.json()["base_url"] == "https://gateway.example.com/v1"
    assert result.json()["chat_model"] == "my-model"
    assert result.json()["vision_model"] == "my-vision"
    assert result.json()["temperature"] == 0
    assert result.json()["last_verified_at"] == "2026-09-08T00:00:00Z"
    assert "encrypted_api_key" not in result.json()
    assert "sk-alice-private-key" not in result.text


def test_provider_change_clears_key_and_uses_defaults(client, saved_config):
    result = client.put("/api/settings/llm", json={"provider": "deepseek"})
    assert result.status_code == 200
    data = result.json()
    assert data["base_url"] == "https://api.deepseek.com/v1"
    assert data["chat_model"] == "deepseek-chat"
    assert data["vision_model"] is None
    assert not data["has_key"] and not data["is_enabled"]
    assert data["last_verified_at"] is None


def test_key_changes_are_encrypted_cleared_and_isolated(client, db, saved_config):
    bob = {**copy.deepcopy(saved_config), "id": "config-bob", "user_id": "bob"}
    db.rows["llm_configs"].append(bob)
    result = client.put("/api/settings/llm", json={"api_key": "sk-replacement-key"})
    assert result.status_code == 200
    assert "sk-replacement-key" not in result.text
    assert decrypt_secret(saved_config["encrypted_api_key"]) == "sk-replacement-key"
    assert decrypt_secret(bob["encrypted_api_key"]) == "sk-alice-private-key"
    assert client.put("/api/settings/llm", json={"api_key": ""}).json()["source"] == "unconfigured"
    assert saved_config["encrypted_api_key"] is None
    assert not saved_config["is_enabled"]
    assert client.delete("/api/settings/llm").status_code == 200
    assert db.rows["llm_configs"] == [bob]


def test_draft_probe_merges_all_fields_and_preserves_database(client, db, saved_config, monkeypatch):
    before = copy.deepcopy(db.rows)
    fake, configs = probe(monkeypatch)
    result = client.post("/api/settings/llm/test", json={
        "provider": "openai", "base_url": "https://draft.example.com/v1",
        "chat_model": "draft-model", "vision_model": "draft-vision", "temperature": 0,
    })
    assert result.status_code == 200, result.text
    assert configs[0].api_key == "sk-alice-private-key"
    assert configs[0].chat_model == "draft-model"
    assert configs[0].vision_model == "draft-vision"
    assert configs[0].base_url == "https://draft.example.com/v1"
    assert fake.calls[0]["temperature"] == 0
    assert fake.closed
    assert db.rows == before
    assert not any(call[1] in ("update", "insert") for call in db.calls)


def test_draft_without_user_key_never_sends_global_key(client, monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-server-secret")
    fake, configs = probe(monkeypatch)
    result = client.post("/api/settings/llm/test", json={"base_url": "https://attacker.example.com/v1"})
    assert result.status_code == 400
    assert not fake.calls and not configs
    assert "sk-server-secret" not in result.text


def test_probe_without_body_uses_active_fallback_when_saved_config_disabled(client, saved_config, monkeypatch):
    saved_config["is_enabled"] = False
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-server-secret")
    before = copy.deepcopy(saved_config)
    fake, configs = probe(monkeypatch)
    assert client.post("/api/settings/llm/test").status_code == 200
    assert configs[0].source == "global"
    assert configs[0].api_key == "sk-server-secret"
    assert saved_config == before
    assert fake.closed


def test_test_endpoint_does_not_leak_or_persist_provider_error(client, saved_config, monkeypatch):
    error = AuthenticationError(
        "Provider echoed sk-alice-private-key and gAAAA-ciphertext",
        response=httpx.Response(401, request=httpx.Request("POST", "https://api.example.com/v1")),
        body={"secret": "sk-alice-private-key"},
    )
    fake, _ = probe(monkeypatch, error)
    result = client.post("/api/settings/llm/test")
    assert result.status_code == 400
    assert "认证失败" in result.json()["detail"]
    assert "sk-alice-private-key" not in result.text
    assert "sk-alice-private-key" not in saved_config["last_error"]
    assert fake.closed


def test_old_stored_provider_error_is_not_reflected(client, saved_config):
    saved_config["last_error"] = "old unredacted sk-secret"
    result = client.get("/api/settings/llm")
    assert "sk-secret" not in result.text
    assert result.json()["last_error"]


def test_validation_errors_do_not_echo_a_request_key(client):
    secret = "sk-super-private-key"
    result = client.put("/api/settings/llm", json={"api_key": secret, "temperature": 5})
    assert result.status_code == 422
    assert secret not in result.text
    result = client.put("/api/settings/llm", json={"api_key": secret * 500})
    assert result.status_code == 422
    assert secret not in result.text


@pytest.mark.parametrize("url", [
    "http://api.example.com/v1", "https://127.0.0.1/v1", "https://[::1]/v1",
    "https://10.1.2.3/v1", "https://169.254.169.254/latest", "https://localhost/v1",
    "https://test.local/v1", "https://user:secret@api.example.com/v1",
    "https://api.example.com/v1?api_key=secret", "https://api.example.com/v1#secret",
    "https://api.example.com:bad/v1", "https://[::ffff:127.0.0.1]/v1",
])
def test_unsafe_urls_rejected(client, url):
    result = client.put("/api/settings/llm", json={"base_url": url})
    assert result.status_code == 400
    assert "secret" not in result.text


def test_public_hostname_resolving_to_private_or_mixed_ips_rejected(monkeypatch):
    monkeypatch.setattr(socket, "getaddrinfo", lambda *a, **k: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443)),
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", 443)),
    ])
    with pytest.raises(llm_service.InvalidLLMConfig):
        llm_service.validate_base_url("https://public-name.example.com/v1")


def test_azure_explicitly_unsupported_and_blank_model_rejected(client):
    assert client.put("/api/settings/llm", json={"provider": "azure_openai"}).status_code == 400
    assert client.post("/api/settings/llm/test", json={"provider": "azure_openai"}).status_code == 400
    assert client.put("/api/settings/llm", json={"chat_model": "   "}).status_code == 400


def test_zero_temperature_and_correct_vision_fallback(saved_config):
    saved_config["vision_model"] = None
    cfg = llm_service.resolve_llm_config("alice")
    assert cfg.temperature == 0
    assert cfg.vision_model == "my-model"
    assert "sk-alice-private-key" not in repr(cfg)


def test_broken_key_does_not_silently_switch_provider(saved_config, monkeypatch):
    saved_config["encrypted_api_key"] = "corrupted-ciphertext"
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "sk-server-secret")
    with pytest.raises(llm_service.InvalidLLMConfig, match="无法解密"):
        llm_service.resolve_llm_config("alice")
    assert llm_service.config_source(saved_config) == "unconfigured"


def test_configuration_read_failure_is_safe(client, db):
    db.fail_table = "llm_configs"
    result = client.get("/api/settings/llm")
    assert result.status_code == 503
    assert "sk-secret" not in result.text
