from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # 服务端兜底 LLM：可留空，改为由每位用户在设置页自配
    OPENAI_API_KEY: str | None = None
    OPENAI_BASE_URL: str | None = None
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_VISION_MODEL: str = "gpt-4o"

    # 用于加密用户自配 API Key；留空则回落到 SUPABASE_JWT_SECRET
    LLM_KEY_ENCRYPTION_KEY: str | None = None

    ALLOWED_ORIGINS: str = "http://localhost:3000"
    ADMIN_USER_IDS: str = ""
    AUTH_PHONE_ENABLED: bool = False
    AUTH_GOOGLE_ENABLED: bool = False
    AUTH_WECHAT_PROVIDER: str = ""

    @property
    def admin_user_ids(self) -> set[str]:
        return {value.strip() for value in self.ADMIN_USER_IDS.split(",") if value.strip()}

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()  # type: ignore[call-arg]
