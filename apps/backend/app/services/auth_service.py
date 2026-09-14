"""Public provider registry. Credentials and session issuance stay in Supabase Auth."""
import re
from app.core.config import settings


def authentication_config() -> dict:
    wechat = settings.AUTH_WECHAT_PROVIDER.strip()
    configured_wechat = bool(re.fullmatch(r"custom:[a-z0-9][a-z0-9_-]{0,63}", wechat))
    return {
        "email_enabled": True, "phone_enabled": settings.AUTH_PHONE_ENABLED, "phone_method": "sms_otp",
        "providers": [
            {"id": "google", "label": "Google", "enabled": settings.AUTH_GOOGLE_ENABLED,
             "provider": "google" if settings.AUTH_GOOGLE_ENABLED else None,
             "status": "enabled" if settings.AUTH_GOOGLE_ENABLED else "not_configured"},
            {"id": "wechat", "label": "微信", "enabled": configured_wechat,
             "provider": wechat if configured_wechat else None,
             "status": "enabled" if configured_wechat else "not_configured"},
        ],
    }
