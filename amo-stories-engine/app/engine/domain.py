"""Domain System — Unique Skill authority over Normal Skills.

Each Unique Skill creates a Domain where:
1. It is IMMUNE to Normal Skills of the same category
2. It has AUTHORITY bonus (+3%) in combat against same-category Normal Skills

Domain does NOT:
- Immune against Normal Skills of OTHER categories
- Immune against other Unique Skills (future MMO)
- Increase raw damage
- Change combat score formula
"""

from __future__ import annotations


# ──────────────────────────────────────────────
# Domain Rules per Category
# ──────────────────────────────────────────────

DOMAIN_RULES: dict[str, dict] = {
    "perception": {
        "immunity": (
            "Normal perception/analysis skills KHÔNG thể feed thông tin sai cho player. "
            "Nếu Normal perception nói A, Unique perception nói B → B luôn đúng."
        ),
        "authority_bonus": 0.03,
        "narrative": "Mắt bạn nhìn xuyên qua ảo ảnh mà kỹ năng thường nhìn thấy.",
    },
    "manifestation": {
        "immunity": (
            "Normal defensive/offensive manifestation skills KHÔNG thể cancel "
            "Unique manifestation. Normal barrier không chặn được Unique physical attack."
        ),
        "authority_bonus": 0.03,
        "narrative": "Sức mạnh này không tuân theo quy luật thông thường.",
    },
    "manipulation": {
        "immunity": (
            "Normal manipulation/control skills KHÔNG thể override Unique manipulation. "
            "Normal terrain control bị phủ bởi Unique terrain control."
        ),
        "authority_bonus": 0.03,
        "narrative": "Khi bạn thay đổi thế giới, thế giới NGHE.",
    },
    "contract": {
        "immunity": (
            "Normal contract/binding skills KHÔNG thể phá Unique contract. "
            "All pacts sealed by Unique contract = unbreakable by normal means."
        ),
        "authority_bonus": 0.03,
        "narrative": "Lời thề của bạn khắc vào thực tại — không ai gỡ được bằng sức mạnh thường.",
    },
    "obfuscation": {
        "immunity": (
            "Normal detection/reveal skills KHÔNG thể phá Unique obfuscation. "
            "Player's stealth = impenetrable by Normal perception."
        ),
        "authority_bonus": 0.03,
        "narrative": "Bạn biến mất — không phải ẩn, mà là KHÔNG TỒN TẠI trong nhận thức họ.",
    },
}


# ──────────────────────────────────────────────
# Axis Blind Spots — Structural weakness per category
# ──────────────────────────────────────────────

AXIS_BLIND_SPOTS: dict[str, str] = {
    "manifestation": "Chỉ tác động trực tiếp — không buff/shield từ xa cho đồng đội",
    "perception":    "Không tăng damage/defense trực tiếp",
    "contract":      "Không tác dụng nếu đối phương không tương tác/giao tiếp",
    "manipulation":  "Không burst damage, không instant kill",
    "obfuscation":   "Không thể tank trực diện khi bị lộ",
}


# ──────────────────────────────────────────────
# Domain Scaling per Growth Stage
# ──────────────────────────────────────────────

DOMAIN_SCALING: dict[str, dict] = {
    "seed": {
        "description": "Immune Normal cùng category. +3% combat bonus",
        "immunity_tier_cap": 3,       # Only immune vs Tier 1-3
        "narrative_effect": False,     # No NPC reaction
    },
    "bloom": {
        "description": "Mở rộng: Normal skills cùng category không thể counter",
        "immunity_tier_cap": 3,
        "narrative_effect": False,
    },
    "aspect": {
        "description": "Domain ảnh hưởng narrative: NPC cảm nhận domain power",
        "immunity_tier_cap": 3,
        "narrative_effect": True,      # NPCs sense domain aura
    },
    "ultimate": {
        "description": "Vượt Tier 3: chỉ Unique Skill khác mới counter được",
        "immunity_tier_cap": 99,       # Immune to ALL normal skill tiers
        "narrative_effect": True,
    },
}


# ──────────────────────────────────────────────
# Combat Functions
# ──────────────────────────────────────────────

def get_domain_rule(category: str) -> dict | None:
    """Get the domain rule for a skill category."""
    return DOMAIN_RULES.get(category)


def get_axis_blind_spot(category: str) -> str:
    """Get the structural blind spot for a category."""
    return AXIS_BLIND_SPOTS.get(category, "")


def get_domain_scaling(stage: str) -> dict:
    """Get domain scaling info for a growth stage."""
    return DOMAIN_SCALING.get(stage, DOMAIN_SCALING["seed"])


def apply_domain_bonus(
    player_skill_category: str,
    enemy_skills: list[dict],
    player_stage: str = "seed",
) -> float:
    """Apply Domain authority bonus if enemy uses a same-category Normal Skill.

    Args:
        player_skill_category: Player's Unique Skill category
        enemy_skills: List of enemy skill dicts with 'category' and 'tier' keys
        player_stage: Player's growth stage (affects tier cap)

    Returns:
        Combat bonus (0.0 or 0.03)
    """
    rule = DOMAIN_RULES.get(player_skill_category)
    if not rule:
        return 0.0

    scaling = get_domain_scaling(player_stage)
    tier_cap = scaling["immunity_tier_cap"]

    for enemy_skill in enemy_skills:
        enemy_category = enemy_skill.get("category", "")
        enemy_tier = enemy_skill.get("tier", 1)
        if enemy_category == player_skill_category and enemy_tier <= tier_cap:
            return rule["authority_bonus"]  # +3%

    return 0.0
