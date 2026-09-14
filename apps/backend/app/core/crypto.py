"""用户 API Key 的对称加密存储。

设计原则：
  * 明文 Key 只在内存中流转，落库一律是 Fernet 密文
  * 密钥来自环境变量 LLM_KEY_ENCRYPTION_KEY；未配置时回落到 SUPABASE_JWT_SECRET
  * 回显给前端的永远是掩码（sk-…7f3a），不是原文

⚠️ 更换 LLM_KEY_ENCRYPTION_KEY 会导致已存的密文全部无法解密，
   届时需要用户重新录入 Key —— 生产环境请把它当作不可变更的密钥管理。
"""
from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None


def _derive_key(secret: str) -> bytes:
    """把任意长度的服务端密钥推导成合法的 Fernet key（32 字节 urlsafe base64）。"""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet() -> Fernet:
    global _fernet
    if _fernet is None:
        raw = settings.LLM_KEY_ENCRYPTION_KEY or settings.SUPABASE_JWT_SECRET
        if not raw:
            raise RuntimeError(
                "缺少加密密钥：请配置 LLM_KEY_ENCRYPTION_KEY 或 SUPABASE_JWT_SECRET"
            )
        _fernet = Fernet(_derive_key(raw))
    return _fernet


def encrypt_secret(plaintext: str) -> str:
    """加密用户 API Key，返回可安全落库的字符串。"""
    if not plaintext:
        raise ValueError("待加密内容为空")
    return get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    """解密用户 API Key。密文损坏或密钥变更时抛 InvalidToken。"""
    try:
        return get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        logger.error("用户 API Key 解密失败，可能是加密密钥已变更")
        raise ValueError("API Key 解密失败，请重新配置") from exc


def mask_secret(plaintext: str) -> str:
    """生成可安全回显的掩码，如 sk-…7f3a。"""
    if not plaintext:
        return ""
    if len(plaintext) <= 8:
        return "*" * len(plaintext)
    return f"{plaintext[:3]}…{plaintext[-4:]}"
