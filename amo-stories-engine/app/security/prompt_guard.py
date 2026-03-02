"""Prompt injection defense for player free_input.

Sanitize player text before it enters the LLM pipeline to prevent:
  - Meta-instructions that override narrative rules
  - Stat manipulation via natural language
  - System prompt extraction
  - Jailbreaking patterns

Design:
  - Reject on detection (raise ValueError with a user-friendly message)
  - The caller (input_parser) wraps the cleaned text in a quoted delimiter
    so the LLM sees it as player speech, not as instructions.
"""

from __future__ import annotations

import logging
import re

logger = logging.getLogger("amo.prompt_guard")

# ── Hard limit on player input length ──────────────────────────────────────
_MAX_LENGTH = 500

# ── Injection detection patterns ───────────────────────────────────────────
# Each pattern is compiled case-insensitively.  Any match triggers rejection.
_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Meta-instruction overrides
    (re.compile(r"ignore\s+(previous|all|above|prior)\s+instructions?", re.I), "instruction_override"),
    (re.compile(r"forget\s+(everything|all|previous|prior|the\s+story)", re.I), "forget_instruction"),
    (re.compile(r"(new|different|updated)\s+system\s+prompt", re.I), "system_prompt_swap"),
    (re.compile(r"\bsystem\s+prompt\b", re.I), "system_prompt_ref"),
    (re.compile(r"\bassistant\s*:", re.I), "role_injection"),

    # Role / identity hijacking
    (re.compile(r"(you are now|act as|pretend (to be|you are)|roleplay as)\s+", re.I), "role_hijack"),
    (re.compile(r"\bDAN\s+mode\b|\bjailbreak\b|\bdeveloper\s+mode\b", re.I), "jailbreak"),

    # Stat / power manipulation
    (re.compile(
        r"(set|change|hack|modify|grant|give|boost|max(imize)?|unlock)\s+"
        r"(my\s+)?(stat|hp|health|power|level|skill|instability|breakthrough|alignment|fate|damage|atk|def)",
        re.I,
    ), "stat_hack"),
    (re.compile(r"\bgod\s*mode\b|\binfinite\s+(health|power|mana|skill)\b", re.I), "godmode"),

    # Override narrative / safety
    (re.compile(r"(override|bypass|disable|skip|remove)\s+(the\s+)?(narrative|rules?|filter|safety|limit)", re.I), "rule_bypass"),
    (re.compile(r"\badmin\s+(mode|access|command)\b", re.I), "admin_command"),

    # Template / code injection
    (re.compile(r"\{\{.*?\}\}", re.I), "template_injection"),
    (re.compile(r"</?script", re.I), "script_injection"),

    # Prompt extraction
    (re.compile(r"(print|repeat|show|reveal|output|display)\s+(the\s+)?(system|full|original|hidden)\s+prompt", re.I), "prompt_leak"),
    (re.compile(r"what (are|were) your instructions?", re.I), "instruction_probe"),
]


def sanitize_free_input(text: str) -> str:
    """Sanitize player free_input before LLM ingestion.

    Args:
        text: Raw player-supplied action string.

    Returns:
        Sanitized text (length-capped, safe for LLM prompt insertion).

    Raises:
        ValueError: If injection patterns are detected.  The message is
                    user-facing; do not expose internal pattern names.
    """
    if not text:
        return text

    # 1. Length cap — prevents context stuffing attacks
    if len(text) > _MAX_LENGTH:
        text = text[:_MAX_LENGTH]

    # 2. Pattern scan
    for pattern, label in _PATTERNS:
        if pattern.search(text):
            logger.warning(
                "[amo-guardian] Prompt injection blocked (%s): %r",
                label,
                text[:120],
            )
            raise ValueError(
                "Nội dung không hợp lệ. Hãy mô tả hành động của nhân vật một cách tự nhiên."
            )

    return text
