"""Resolve private user settings and create bounded, per-request LLM clients."""
from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass, field
from urllib.parse import urlsplit, urlunsplit

import httpx
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI

from app.core.config import settings
from app.core.crypto import decrypt_secret
from app.core.supabase_client import supabase
from app.models.schemas import PROVIDER_DEFAULTS


class LLMNotConfigured(Exception):
    """No enabled user credential and no server fallback."""


class InvalidLLMConfig(Exception):
    """A safe, user-facing configuration error; never wrap provider text here."""


@dataclass(frozen=True)
class LLMConfig:
    api_key: str = field(repr=False)
    base_url: str | None
    chat_model: str
    vision_model: str
    temperature: float
    source: str


def validate_base_url(value: str | None, *, resolve_dns: bool = True) -> str | None:
    """User endpoints must be public HTTPS URLs without secrets or redirects.

    Check on save and before every HTTP request. Deployments must also block
    private/link-local egress at the network layer to close DNS-rebinding races.
    Server-owned OPENAI_BASE_URL is intentionally trusted independently.
    """
    if not value:
        return None
    value = value.strip()
    try:
        parts = urlsplit(value)
        port = parts.port
        hostname = parts.hostname
    except ValueError:
        raise InvalidLLMConfig("API 地址格式无效") from None
    if (
        parts.scheme != "https" or not hostname or parts.username is not None
        or parts.password is not None or parts.query or parts.fragment
        or any(c.isspace() or ord(c) < 32 for c in value) or "\\" in value
        or "%" in parts.netloc
    ):
        raise InvalidLLMConfig("API 地址须为 HTTPS，且不能包含凭据、查询参数或片段")
    hostname = hostname.lower().rstrip(".")
    if "." not in hostname and ":" not in hostname:
        raise InvalidLLMConfig("API 地址必须是公网域名或公网 IP")
    if hostname.endswith((".localhost", ".local", ".internal", ".test", ".invalid")):
        raise InvalidLLMConfig("API 地址不能指向本机或内网")
    try:
        addresses = [ipaddress.ip_address(hostname)]
    except ValueError:
        addresses = []
        if resolve_dns:
            try:
                answers = socket.getaddrinfo(hostname, port or 443, type=socket.SOCK_STREAM)
                addresses = [ipaddress.ip_address(a[4][0]) for a in answers]
            except (OSError, ValueError):
                raise InvalidLLMConfig("无法解析 API 地址，请检查域名") from None
            if not addresses:
                raise InvalidLLMConfig("无法解析 API 地址，请检查域名")
    if any(not address.is_global for address in addresses):
        raise InvalidLLMConfig("API 地址不能指向本机、内网或保留地址")
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/"), "", ""))


def provider_error_message(exc: Exception) -> str:
    """Map provider failures without reflecting a response body, URL or key."""
    if isinstance(exc, APITimeoutError):
        return "模型服务连接超时，请稍后重试"
    if isinstance(exc, APIConnectionError):
        return "无法连接模型服务，请检查 API 地址后重试"
    if isinstance(exc, APIStatusError):
        if exc.status_code in (401, 403):
            return "模型服务认证失败，请检查 API Key 和访问权限"
        if exc.status_code == 429:
            return "模型服务额度不足或请求过多，请稍后重试"
        if exc.status_code == 404:
            return "模型或 API 地址不存在，请检查配置"
    if isinstance(exc, InvalidLLMConfig):
        return str(exc)  # only fixed messages created by this module
    if isinstance(exc, LLMNotConfigured):
        return "尚未配置 LLM，请在设置中填写 API Key"
    return "模型服务请求失败，请检查配置或稍后重试"


def read_user_config(user_id: str) -> dict | None:
    res = supabase.table("llm_configs").select("*").eq("user_id", user_id).maybe_single().execute()
    return res.data if res else None


def _global_config() -> LLMConfig:
    if not settings.OPENAI_API_KEY:
        raise LLMNotConfigured()
    return LLMConfig(
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
        chat_model=settings.OPENAI_MODEL,
        vision_model=settings.OPENAI_VISION_MODEL,
        temperature=0.3,
        source="global",
    )


def config_from_row(row: dict, *, resolve_dns: bool = True) -> LLMConfig:
    if row.get("provider") == "azure_openai":
        raise InvalidLLMConfig("暂不支持 Azure OpenAI，请选择 OpenAI 兼容服务")
    if not row.get("encrypted_api_key"):
        raise LLMNotConfigured()
    try:
        api_key = decrypt_secret(row["encrypted_api_key"])
    except (ValueError, RuntimeError):
        raise InvalidLLMConfig("已存 API Key 无法解密，请重新录入") from None
    defaults = PROVIDER_DEFAULTS.get(row.get("provider", "openai"))
    base_url = row.get("base_url") or (defaults[0] if defaults else None)
    if not base_url:
        raise InvalidLLMConfig("自定义服务必须填写 API 地址")
    chat_model = row.get("chat_model") or (defaults[1] if defaults else None)
    if not chat_model:
        raise InvalidLLMConfig("请填写聊天模型名称")
    return LLMConfig(
        api_key=api_key,
        base_url=validate_base_url(base_url, resolve_dns=resolve_dns),
        chat_model=chat_model,
        vision_model=row.get("vision_model") or chat_model,
        temperature=float(0.3 if row.get("temperature") is None else row["temperature"]),
        source="user",
    )


def config_source(row: dict | None) -> str:
    if row and row.get("is_enabled") and row.get("encrypted_api_key"):
        try:
            config_from_row(row, resolve_dns=False)
        except (InvalidLLMConfig, LLMNotConfigured):
            return "unconfigured"
        return "user"
    return "global" if settings.OPENAI_API_KEY else "unconfigured"


def resolve_llm_config(user_id: str) -> LLMConfig:
    try:
        row = read_user_config(user_id)
    except Exception:
        # Never silently use another provider when saved preferences cannot be read.
        raise InvalidLLMConfig("无法读取 AI 配置，请稍后重试或联系管理员完成数据库迁移") from None
    if row and row.get("is_enabled") and row.get("encrypted_api_key"):
        return config_from_row(row)
    return _global_config()


def create_llm_client(cfg: LLMConfig) -> AsyncOpenAI:
    async def check_public_endpoint(request: httpx.Request) -> None:
        # Also checks retries and paths derived by the SDK. Do not follow redirects.
        # The actual request has no API-key query parameters.
        import asyncio
        await asyncio.to_thread(validate_base_url, str(request.url))

    http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(45.0, connect=10.0),
        follow_redirects=False,
        trust_env=False,
        event_hooks={"request": [check_public_endpoint]} if cfg.source == "user" else {},
    )
    return AsyncOpenAI(
        api_key=cfg.api_key, base_url=cfg.base_url, http_client=http_client,
        timeout=45.0, max_retries=1,
    )


def get_llm_client(user_id: str) -> tuple[AsyncOpenAI, LLMConfig]:
    cfg = resolve_llm_config(user_id)
    return create_llm_client(cfg), cfg
