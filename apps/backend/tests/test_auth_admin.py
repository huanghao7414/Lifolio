from types import SimpleNamespace
import httpx
import pytest
from fastapi.testclient import TestClient
from app.core import auth
from app.core.config import settings
from app.services.monitoring_service import ServiceMetrics
from main import app

USER_ID = "11111111-1111-4111-8111-111111111111"


@pytest.fixture
def real_auth_client(db, monkeypatch):
    app.dependency_overrides.clear()
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", "")
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


def mock_auth(monkeypatch, status=200, body=None, failure=False):
    calls = []
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, headers):
            calls.append((url, headers))
            if failure: raise httpx.ConnectError("secret upstream details")
            return httpx.Response(status, json=body if body is not None else {
                "id": USER_ID, "email": "test@example.com", "phone": "8613812345678",
                "user_metadata": {"display_name": "Alice", "is_admin": True, "role": "admin"},
                "app_metadata": {"providers": ["email", "phone"]},
            })
    monkeypatch.setattr(auth.httpx, "AsyncClient", Client)
    return calls


@pytest.mark.parametrize("path", ["/api/auth/me", "/api/admin/overview", "/api/conversations", "/api/settings/llm", "/api/profile"])
def test_private_routes_require_session(real_auth_client, path):
    result = real_auth_client.get(path)
    assert result.status_code == 401
    assert result.headers["www-authenticate"] == "Bearer"


def test_identity_is_verified_by_configured_auth_not_untrusted_metadata(real_auth_client, monkeypatch):
    calls = mock_auth(monkeypatch)
    result = real_auth_client.get("/api/auth/me", headers={"Authorization": "Bearer access-token"})
    assert result.status_code == 200
    assert result.json()["id"] == USER_ID and result.json()["is_admin"] is False
    assert result.json()["providers"] == ["email", "phone"]
    assert calls == [(settings.SUPABASE_URL + "/auth/v1/user", {"apikey": settings.SUPABASE_ANON_KEY, "Authorization": "Bearer access-token"})]


@pytest.mark.parametrize("status, expected", [(401, 401), (403, 401), (500, 503), (302, 503)])
def test_invalid_expired_or_unavailable_auth_fails_closed(real_auth_client, monkeypatch, status, expected):
    mock_auth(monkeypatch, status, {"detail": "private provider error"})
    result = real_auth_client.get("/api/auth/me", headers={"Authorization": "Bearer forged"})
    assert result.status_code == expected
    assert "private provider" not in result.text


def test_auth_network_failure_has_readable_safe_error(real_auth_client, monkeypatch):
    mock_auth(monkeypatch, failure=True)
    result = real_auth_client.get("/api/auth/me", headers={"Authorization": "Bearer token"})
    assert result.status_code == 503 and "secret" not in result.text


def test_missing_auth_subject_cannot_create_identity(real_auth_client, monkeypatch):
    mock_auth(monkeypatch, body={"id": "invalid"})
    assert real_auth_client.get("/api/auth/me", headers={"Authorization": "Bearer token"}).status_code == 503


def test_nonadmin_cannot_inspect_data_even_with_spoofed_metadata(real_auth_client, monkeypatch, db):
    mock_auth(monkeypatch)
    result = real_auth_client.get("/api/admin/overview", headers={"Authorization": "Bearer token"})
    assert result.status_code == 403
    assert db.calls == []


def test_configured_admin_gets_counts_without_contents_or_keys(real_auth_client, monkeypatch, db):
    mock_auth(monkeypatch)
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", f" {USER_ID}, ")
    db.rows["user_profiles"] = [{"id": USER_ID, "display_name": "Alice", "created_at": "2026-09-09T00:00:00Z", "private": "hidden"}]
    db.rows["chat_messages"] = [{"id": "message", "content": "private financial chat"}]
    db.rows["llm_configs"] = [{"id": "config", "encrypted_api_key": "private ciphertext"}]
    result = real_auth_client.get("/api/admin/overview", headers={"Authorization": "Bearer token"})
    assert result.status_code == 200
    body = result.json()
    assert body["totals"]["users"] == 1 and body["totals"]["messages"] == 1
    assert body["status"] == "ok" and body["metrics"]["scope"] == "current_process"
    assert "private financial chat" not in result.text and "ciphertext" not in result.text and "hidden" not in result.text
    assert all(call[1] == "select" for call in db.calls)


def test_partial_database_failure_is_unknown_not_zero(real_auth_client, monkeypatch, db):
    mock_auth(monkeypatch)
    monkeypatch.setattr(settings, "ADMIN_USER_IDS", USER_ID)
    db.fail_table = "conversations"
    body = real_auth_client.get("/api/admin/overview", headers={"Authorization": "Bearer token"}).json()
    assert body["status"] == "degraded" and body["totals"]["conversations"] is None
    assert body["totals"]["users"] == 0
    db.fail_table = "user_profiles"
    result = real_auth_client.get("/ready")
    assert result.status_code == 503 and "sk-secret" not in result.text


def test_public_provider_registry_contains_no_secrets(real_auth_client, monkeypatch):
    monkeypatch.setattr(settings, "AUTH_PHONE_ENABLED", True)
    monkeypatch.setattr(settings, "AUTH_GOOGLE_ENABLED", True)
    monkeypatch.setattr(settings, "AUTH_WECHAT_PROVIDER", "custom:wechat")
    body = real_auth_client.get("/api/auth/config").json()
    assert body["phone_method"] == "sms_otp" and body["phone_enabled"]
    assert body["providers"][1]["provider"] == "custom:wechat"
    monkeypatch.setattr(settings, "AUTH_WECHAT_PROVIDER", "https://untrusted.example")
    assert real_auth_client.get("/api/auth/config").json()["providers"][1]["enabled"] is False


def test_metrics_are_bounded_and_report_error_counts():
    metrics = ServiceMetrics()
    for n in range(1100): metrics.record("GET", "/api/items/{id}", 500 if n == 0 else 200, 10)
    result = metrics.snapshot()
    assert result["requests"] == 1100 and result["server_errors"] == 1
    assert result["latency_sample_count"] == 1000 and result["p95_latency_ms"] == 10
    assert len(result["routes"]) == 1
