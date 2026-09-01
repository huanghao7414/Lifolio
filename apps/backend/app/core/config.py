from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_JWT_SECRET: str

    # LLM API — supports any OpenAI-compatible endpoint (DeepSeek, Ollama, Groq, etc.)
    # LLM_BASE_URL: leave empty to use the default OpenAI endpoint.
    # LLM_API_KEY falls back to OPENAI_API_KEY for backward compatibility.
    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o"
    LLM_VISION_MODEL: str = "gpt-4o"

    # Deprecated aliases kept for backward compatibility
    @property
    def effective_api_key(self) -> str:
        return self.LLM_API_KEY or self.OPENAI_API_KEY

    @property
    def OPENAI_MODEL(self) -> str:  # noqa: N802
        return self.LLM_MODEL

    @property
    def OPENAI_VISION_MODEL(self) -> str:  # noqa: N802
        return self.LLM_VISION_MODEL

    ALLOWED_ORIGINS: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]


settings = Settings()  # type: ignore[call-arg]
