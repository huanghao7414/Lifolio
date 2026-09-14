"""Authenticated AI settings. Only encrypted keys are persisted; no keys are returned."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user_id
from app.core.config import settings
from app.core.crypto import encrypt_secret, mask_secret
from app.core.supabase_client import supabase
from app.models.schemas import PROVIDER_DEFAULTS, LLMSettingsOut, LLMSettingsUpdate
from app.services import llm_service

router = APIRouter()
_TABLE = "llm_configs"


def _to_out(row: dict | None) -> LLMSettingsOut:
    row = row or {}
    return LLMSettingsOut(
        provider=row.get("provider", "openai"),
        base_url=row.get("base_url"),
        chat_model=row.get("chat_model") or settings.OPENAI_MODEL,
        vision_model=row.get("vision_model"),
        temperature=float(0.3 if row.get("temperature") is None else row["temperature"]),
        is_enabled=bool(row.get("is_enabled")),
        has_key=bool(row.get("encrypted_api_key")),
        key_hint=row.get("key_hint") if row.get("encrypted_api_key") else None,
        last_verified_at=row.get("last_verified_at"),
        # Old versions stored raw provider errors. Never return their content.
        last_error="上次连接测试失败，请检查配置后重试" if row.get("last_error") else None,
        source=llm_service.config_source(row),
        updated_at=row.get("updated_at"),
    )


def _read(user_id: str) -> dict | None:
    try:
        return llm_service.read_user_config(user_id)
    except Exception:
        raise HTTPException(503, "无法读取 AI 配置，请稍后重试或联系管理员完成数据库迁移") from None


def _merge(body: LLMSettingsUpdate, existing: dict | None) -> dict:
    """One merge path for saving and testing; omitted values preserve the draft."""
    draft = dict(existing or {
        "provider": "openai", "base_url": PROVIDER_DEFAULTS["openai"][0],
        "chat_model": PROVIDER_DEFAULTS["openai"][1], "vision_model": None,
        "temperature": 0.3, "is_enabled": False, "encrypted_api_key": None,
        "key_hint": None,
    })
    if body.provider == "azure_openai":
        raise HTTPException(400, "暂不支持 Azure OpenAI，请选择 OpenAI 兼容服务")
    if body.provider is not None and body.provider != draft["provider"]:
        defaults = PROVIDER_DEFAULTS.get(body.provider)
        draft.update(
            provider=body.provider, base_url=defaults[0] if defaults else None,
            chat_model=defaults[1] if defaults else "", vision_model=None,
            encrypted_api_key=None, key_hint=None, is_enabled=False,
        )
    if "base_url" in body.model_fields_set:
        draft["base_url"] = (body.base_url or "").strip() or None
    if body.chat_model is not None:
        draft["chat_model"] = body.chat_model.strip()
    if "vision_model" in body.model_fields_set:
        draft["vision_model"] = (body.vision_model or "").strip() or None
    if body.temperature is not None:
        draft["temperature"] = body.temperature
    if body.is_enabled is not None:
        draft["is_enabled"] = body.is_enabled
    if body.api_key is not None:
        plaintext = body.api_key.strip()
        try:
            draft["encrypted_api_key"] = encrypt_secret(plaintext) if plaintext else None
        except RuntimeError:
            raise HTTPException(503, "服务端未配置 API Key 加密密钥，请联系管理员") from None
        draft["key_hint"] = mask_secret(plaintext) if plaintext else None
        if not plaintext:
            draft["is_enabled"] = False
    defaults = PROVIDER_DEFAULTS.get(draft["provider"])
    draft["base_url"] = draft.get("base_url") or (defaults[0] if defaults else None)
    if not draft.get("base_url") or not draft.get("chat_model"):
        raise HTTPException(400, "请填写 API 地址和聊天模型名称")
    try:
        draft["base_url"] = llm_service.validate_base_url(draft["base_url"])
    except llm_service.InvalidLLMConfig as exc:
        raise HTTPException(400, str(exc)) from None
    if draft["is_enabled"] and not draft.get("encrypted_api_key"):
        raise HTTPException(400, "启用自定义配置前请填写 API Key；切换服务商需要重新录入 Key")
    return draft


@router.get("/llm", response_model=LLMSettingsOut)
async def get_llm_settings(user_id: str = Depends(get_current_user_id)):
    return _to_out(_read(user_id))


@router.put("/llm", response_model=LLMSettingsOut)
async def update_llm_settings(body: LLMSettingsUpdate, user_id: str = Depends(get_current_user_id)):
    if not body.model_fields_set:
        raise HTTPException(400, "没有需要更新的字段")
    row = _read(user_id)
    draft = _merge(body, row)
    fields = ("provider", "base_url", "chat_model", "vision_model", "temperature", "is_enabled", "encrypted_api_key", "key_hint")
    updates = {key: draft.get(key) for key in fields if not row or draft.get(key) != row.get(key)}
    if not updates:
        return _to_out(row)
    updates.update(last_verified_at=None, last_error=None, updated_at=datetime.now(timezone.utc).isoformat())
    try:
        if row:
            res = supabase.table(_TABLE).update(updates).eq("user_id", user_id).execute()
        else:
            res = supabase.table(_TABLE).insert({"user_id": user_id, **updates}).execute()
    except Exception:
        raise HTTPException(503, "AI 配置保存失败，请稍后重试") from None
    if not res.data:
        raise HTTPException(503, "AI 配置保存失败，请稍后重试")
    return _to_out(res.data[0])


@router.delete("/llm")
async def delete_llm_settings(user_id: str = Depends(get_current_user_id)):
    try:
        supabase.table(_TABLE).delete().eq("user_id", user_id).execute()
    except Exception:
        raise HTTPException(503, "AI 配置删除失败，请稍后重试") from None
    return {"deleted": True}


def _record_test(user_id: str, row: dict | None, *, error: str | None) -> None:
    if not row:
        return
    updates = {"last_error": error, "last_verified_at": None if error else datetime.now(timezone.utc).isoformat()}
    try:
        query = supabase.table(_TABLE).update(updates).eq("user_id", user_id)
        # Do not verify a newer setting that changed while the probe was running.
        if row.get("updated_at"):
            query = query.eq("updated_at", row["updated_at"])
        query.execute()
    except Exception:
        # A metadata write must not turn a successful provider test into a failure.
        pass


@router.post("/llm/test")
async def test_llm_settings(body: LLMSettingsUpdate | None = None, user_id: str = Depends(get_current_user_id)):
    """Probe an unsaved merged draft, or the active configuration when body is absent."""
    row = _read(user_id)
    try:
        if body is not None:
            draft = _merge(body, row)
            # Never forward the server-owned fallback key to a user-supplied URL.
            cfg = llm_service.config_from_row(draft)
        elif row and row.get("is_enabled") and row.get("encrypted_api_key"):
            cfg = llm_service.config_from_row(row)
        else:
            cfg = llm_service._global_config()
    except (llm_service.InvalidLLMConfig, llm_service.LLMNotConfigured) as exc:
        raise HTTPException(400, llm_service.provider_error_message(exc)) from None
    client = llm_service.create_llm_client(cfg)
    try:
        resp = await client.chat.completions.create(
            model=cfg.chat_model,
            messages=[{"role": "user", "content": "Reply with OK."}],
            max_tokens=5,
            temperature=cfg.temperature,
        )
        if not resp.choices:
            raise ValueError("empty provider response")
    except Exception as exc:
        error = llm_service.provider_error_message(exc)
        if body is None and cfg.source == "user":
            _record_test(user_id, row, error=error)
        raise HTTPException(400, error) from None
    finally:
        await client.close()
    if body is None and cfg.source == "user":
        _record_test(user_id, row, error=None)
    return {"ok": True, "model": cfg.chat_model, "base_url": cfg.base_url if cfg.source == "user" else None}
