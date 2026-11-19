from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Server
    port: int = 8003

    # WAHA (self-hosted WhatsApp HTTP API, GOWS engine)
    waha_base_url: str = "http://localhost:3000"
    waha_api_key: str = ""
    waha_session: str = "default"
    # Public (WAHA-reachable) URL of this gateway's /webhook. Required for
    # automatic session creation; leave unset to configure the webhook by hand.
    waha_webhook_url: str | None = None
    waha_webhook_hmac_key: str = ""
    waha_auto_start_session: bool = True
    waha_voice_convert: bool = True
    waha_request_timeout: float = 60.0
    waha_media_timeout: float = 60.0
    max_media_bytes: int = 25 * 1024 * 1024

    # Chasqui core
    core_url: str = "http://localhost:8090"
    internal_api_key: str = ""

    # Durable idempotency for WAHA webhook retries. SQLite is deliberate:
    # gunicorn runs multiple workers, so an in-process cache would miss
    # duplicates that land on a different worker.
    waha_dedup_db_path: str = "/tmp/chasqui-waha-dedup.sqlite3"
    dedup_ttl_seconds: int = 24 * 60 * 60

    # User-facing gateway fallbacks. English by default (English-only
    # codebase); set them in your users' language via .env — the same posture
    # as the core's FALLBACK_REPLY.
    error_reply: str = (
        "Sorry, we hit a technical issue. Please try again in a few minutes."
    )
    unsupported_reply: str = (
        "For now I only handle text, audio, images, videos and documents. "
        "Send me a message and I'll be glad to help."
    )

    # Sentry
    sentry_dsn: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
