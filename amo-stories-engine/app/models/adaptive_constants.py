"""Amoisekai — Adaptive Engine constants.

Archetype profiles, transmutation maps, villain assignments,
and play style seeding data derived from spec documents.
"""

from __future__ import annotations


# ──────────────────────────────────────────────
# Archetype Profiles (PHASE1_ADAPTIVE_ENGINE §Lớp 1)
# ──────────────────────────────────────────────

ARCHETYPE_PROFILES: dict[str, dict] = {
    "vanguard": {
        "identity_vector": {
            "primary": "combat_first",
            "secondary": "protection",
            "principle_affinity": ["energy", "matter"],
        },
        "identity_vector_numeric": {
            "order": 60, "freedom": 70, "evolution": 50,
            "control": 55, "devotion": 40,
        },
        "drift_triggers": [
            "forced_retreat",
            "unable_to_protect",
            "used_as_weapon",
        ],
        "dna_affinity_bias": ["manifestation", "contract"],
        "starting_zone": "outer_corruption",
        "narrative_bias": 0.25,
    },
    "catalyst": {
        "identity_vector": {
            "primary": "change_environment",
            "secondary": "system_thinker",
            "principle_affinity": ["flux", "entropy"],
        },
        "identity_vector_numeric": {
            "order": 35, "freedom": 75, "evolution": 80,
            "control": 45, "devotion": 50,
        },
        "drift_triggers": [
            "unintended_consequences",
            "blamed_for_change",
            "world_unrecognizable",
        ],
        "dna_affinity_bias": ["manipulation", "perception"],
        "starting_zone": "minor_gate_region",
        "narrative_bias": 0.25,
    },
    "sovereign": {
        "identity_vector": {
            "primary": "influence_people",
            "secondary": "order_control",
            "principle_affinity": ["order"],
        },
        "identity_vector_numeric": {
            "order": 65, "freedom": 45, "evolution": 50,
            "control": 70, "devotion": 75,
        },
        "drift_triggers": [
            "follower_used_as_tool",
            "blind_obedience",
            "isolation_from_power",
        ],
        "dna_affinity_bias": ["contract", "obfuscation"],
        "starting_zone": "grand_gate_city",
        "narrative_bias": 0.25,
    },
    "seeker": {
        "identity_vector": {
            "primary": "uncover_mystery",
            "secondary": "knowledge_driven",
            "principle_affinity": ["void", "entropy"],
        },
        "identity_vector_numeric": {
            "order": 40, "freedom": 65, "evolution": 85,
            "control": 35, "devotion": 45,
        },
        "drift_triggers": [
            "dangerous_truth",
            "trust_betrayed",
            "knowledge_weaponized",
        ],
        "dna_affinity_bias": ["perception"],
        "starting_zone": "ancient_ruins",
        "narrative_bias": 0.25,
    },
    "tactician": {
        "identity_vector": {
            "primary": "manipulate_situation",
            "secondary": "strategic_control",
            "principle_affinity": ["order", "void"],
        },
        "identity_vector_numeric": {
            "order": 70, "freedom": 50, "evolution": 60,
            "control": 85, "devotion": 30,
        },
        "drift_triggers": [
            "plan_causes_harm",
            "people_as_pawns",
            "isolation_from_strategy",
        ],
        "dna_affinity_bias": ["obfuscation", "manipulation"],
        "starting_zone": "ggc_intelligence",
        "narrative_bias": 0.25,
    },
    "wanderer": {
        "identity_vector": {
            "primary": "outside_system",
            "secondary": "freedom_first",
            "principle_affinity": ["flux"],
        },
        "identity_vector_numeric": {
            "order": 25, "freedom": 95, "evolution": 65,
            "control": 20, "devotion": 35,
        },
        "drift_triggers": [
            "forced_responsibility",
            "expected_presence",
            "self_isolation",
        ],
        "dna_affinity_bias": ["perception"],
        "starting_zone": "wild_zone",
        "narrative_bias": 0.25,
    },
}


# ──────────────────────────────────────────────
# Transmutation Map (ARCHETYPE_EVOLUTION_SPEC §4.3)
# Origin archetype → { identity_key: transmuted_form }
# ──────────────────────────────────────────────

TRANSMUTATION_MAP: dict[str, dict[str, str]] = {
    "vanguard": {
        "devotion_order": "bulwark",
        "freedom_entropy": "ravager",
        "control_strategic": "sentinel",
    },
    "catalyst": {
        "order_evolution": "architect",
        "freedom_chaos": "tempest",
        "devotion_evolution": "weaver",
    },
    "sovereign": {
        "order_control": "arbiter",
        "control_extreme": "tyrant",
        "devotion_sacrifice": "shepherd",
    },
    "seeker": {
        "knowledge_perception": "oracle",
        "freedom_questioning": "heretic",
        "order_systematic": "archivist",
    },
    "tactician": {
        "order_planning": "strategist",
        "control_manipulation": "shadow_broker",
        "devotion_negotiation": "diplomat",
    },
    "wanderer": {
        "freedom_allies": "nomad_king",
        "void_loner": "phantom",
        "evolution_explorer": "pathfinder",
    },
}


# ──────────────────────────────────────────────
# Transmuted Form Display Names
# ──────────────────────────────────────────────

TRANSMUTED_DISPLAY_NAMES: dict[str, str] = {
    "bulwark": "Thành Lũy",
    "ravager": "Tàn Phong",
    "sentinel": "Canh Gác",
    "architect": "Kiến Tạo",
    "tempest": "Phong Ba",
    "weaver": "Dệt Sĩ",
    "arbiter": "Phán Quan",
    "tyrant": "Bạo Chúa",
    "shepherd": "Mục Tử",
    "oracle": "Tiên Tri",
    "heretic": "Dị Giáo",
    "archivist": "Lưu Sử",
    "strategist": "Quân Sư",
    "shadow_broker": "Môi Giới Bóng Tối",
    "diplomat": "Sứ Giả",
    "nomad_king": "Vua Du Mục",
    "phantom": "Bóng Ma",
    "pathfinder": "Khai Lộ",
}


# ──────────────────────────────────────────────
# Villain Assignment (PHASE1_ADAPTIVE_ENGINE §Villain)
# Archetype → emissary / general / lieutenant
# ──────────────────────────────────────────────

VILLAIN_ASSIGNMENT: dict[str, dict[str, str]] = {
    "vanguard": {
        "emissary": "Thol",
        "general": "Vorn",
        "lieutenant": "vorn_lieutenant",
    },
    "catalyst": {
        "emissary": "Sira",
        "general": "Vorn",
        "lieutenant": "vorn_lieutenant",
    },
    "sovereign": {
        "emissary": "Sira",
        "general": "Azen",
        "lieutenant": "azen_lieutenant",
    },
    "seeker": {
        "emissary": "Kaen",
        "general": "Mireth",
        "lieutenant": "mireth_lieutenant",
    },
    "tactician": {
        "emissary": "Kaen",
        "general": "Kha",
        "lieutenant": "kha_lieutenant",
    },
    "wanderer": {
        "emissary": "Thol",
        "general": "Kha",
        "lieutenant": "kha_lieutenant",
    },
}


# ──────────────────────────────────────────────
# Play Style Seed Map (BehavioralFingerprint → initial axes)
# Mapping from Soul Forge Phase 3 dimensions
# ──────────────────────────────────────────────

def seed_play_style_from_fingerprint(
    decisiveness: float,
    deliberation: float,
    expressiveness: float,
    confidence: float,
    patience: float,
    consistency: float,
    impulsivity: float,
    revision_tendency: float,
) -> dict[str, int]:
    """Convert 8-dim BehavioralFingerprint → 5 PlayStyle axes.

    All inputs 0.0-1.0 (from Soul Forge Phase 3).
    Returns dict with int values 0-100.
    """

    def to_axis(val: float) -> int:
        return max(0, min(100, int(val * 100)))

    return {
        # risk_appetite: high decisiveness + high impulsivity → risk taker
        "risk_appetite": to_axis(
            decisiveness * 0.4 + impulsivity * 0.4
            + (1.0 - deliberation) * 0.2
        ),
        # alliance_tendency: high expressiveness + high patience → community
        "alliance_tendency": to_axis(
            expressiveness * 0.4 + patience * 0.3
            + (1.0 - impulsivity) * 0.3
        ),
        # curiosity_depth: high deliberation + high patience → deep explorer
        "curiosity_depth": to_axis(
            deliberation * 0.4 + patience * 0.3
            + revision_tendency * 0.3
        ),
        # moral_axis: high consistency + low impulsivity → idealistic
        "moral_axis": to_axis(
            consistency * 0.5 + (1.0 - impulsivity) * 0.3
            + deliberation * 0.2
        ),
        # combat_preference: high decisiveness + high confidence → combat
        "combat_preference": to_axis(
            decisiveness * 0.4 + confidence * 0.3
            + impulsivity * 0.3
        ),
    }


# ──────────────────────────────────────────────
# Empire Threat Tier Mapping
# ──────────────────────────────────────────────

ARCHETYPE_TIER_TO_EMPIRE_THREAT: dict[int, str] = {
    1: "watcher",          # Origin → passive observation
    2: "enforcement",      # Transmuted → active conflict
    3: "general_notice",   # Ascendant → direct confrontation
}
