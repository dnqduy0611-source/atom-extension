"""Amo Stories Engine — Configuration."""

from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """App settings loaded from environment variables."""

    # ──── AI ────
    google_api_key: str = ""

    # ──── Models ────
    # Planner/Simulator: Flash — fast structured output, cost-effective
    # Writer/Critic: Pro — higher prose quality and deeper evaluation
    planner_model: str = "gemini-2.5-flash"
    simulator_model: str = "gemini-2.5-flash"
    writer_model: str = "gemini-2.5-pro"
    critic_model: str = "gemini-2.5-pro"
    identity_model: str = "gemini-2.5-flash"
    onboarding_model: str = "gemini-2.5-flash"

    # ──── Environment ────
    # Set to "production" to enforce auth requirements on startup.
    env: str = "development"

    # ──── Auth ────
    # Supabase JWT Secret (Settings → API → JWT Secret in Supabase dashboard).
    # Leave empty to disable auth in local development.
    supabase_jwt_secret: str = ""

    @field_validator("supabase_jwt_secret", mode="before")
    @classmethod
    def strip_jwt_secret(cls, v: object) -> object:
        """Strip accidental whitespace from JWT secret (common .env paste error)."""
        return v.strip() if isinstance(v, str) else v

    # ──── Server ────
    host: str = "0.0.0.0"
    port: int = 8001
    cors_origins: str = "http://localhost:5173,http://localhost:5180,http://localhost:3000,https://amolofi.com"

    # ──── Storage ────
    db_path: str = "./data/stories.db"

    # ──── Pipeline ────
    max_rewrite_attempts: int = 3
    critic_min_score: float = 7.0
    writer_max_tokens: int = 4096
    writer_temperature: float = 0.85

    # ──── CRNG ────
    pity_base_chance: float = 0.05
    pity_increment: float = 0.02
    pity_max_bonus: float = 0.20
    breakthrough_threshold: float = 90.0

    # ──── Limits ────
    max_chapters_per_day: int = 5
    max_chapters_per_story: int = 200

    # ──── Scene Architecture ────
    scene_mode: bool = True                  # True → scene-based, False → monolithic chapters
    scene_writer_model: str = "gemini-2.5-flash"
    scene_max_words: int = 500
    scene_min_words: int = 200

    # ──── Fate Buffer ────
    fate_buffer_start_decay: int = 15
    fate_buffer_decay_rate: float = 2.5

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
