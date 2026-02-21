"""Amo Stories Engine — Configuration."""

from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings loaded from environment variables."""

    # ──── AI ────
    google_api_key: str = ""

    # ──── Models ────
    planner_model: str = "gemini-2.5-flash"
    simulator_model: str = "gemini-2.5-flash"
    writer_model: str = "gemini-2.5-flash"
    critic_model: str = "gemini-2.5-flash"

    # ──── Server ────
    host: str = "0.0.0.0"
    port: int = 8001
    cors_origins: str = "http://localhost:5173,http://localhost:3000,https://amolofi.com"

    # ──── Storage ────
    db_path: str = "./data/stories.db"

    # ──── Pipeline ────
    max_rewrite_attempts: int = 3
    critic_min_score: float = 7.0
    writer_max_tokens: int = 4096
    writer_temperature: float = 0.85

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def db_file(self) -> Path:
        p = Path(self.db_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
