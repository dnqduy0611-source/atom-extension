"""Amoisekai — AI Skill Evolution Generation.

LLM-powered generation of mutated, hybrid, and integrated skills.
Uses the same ChatGoogleGenerativeAI pattern as skill_narrator.py.

Ref: SKILL_EVOLUTION_SPEC v1.1 §4.6, §4.6.1, §5.4
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from app.config import settings

logger = logging.getLogger(__name__)


# ══════════════════════════════════════════════
# Mutation Skill Generation (§4.6)
# ══════════════════════════════════════════════

_MUTATION_SYSTEM_PROMPT = """\
You are the skill evolution designer for a dark-fantasy isekai RPG called Amoisekai.

Your job: create a MUTATED version of an existing combat skill based on the
player's identity drift. The mutation should feel like the skill evolved to
match who the player has BECOME — not who they started as.

CRITICAL RULES:
1. Skill MỚI phải phản ánh identity HIỆN TẠI, không phải seed
2. Tên mới — liên quan nhưng KHÁC bản chất (English, 2-3 words)
3. Mechanic: biến đổi từ gốc, không hoàn toàn mới
4. Giữ cùng Tier (Tier {tier} → Tier {tier})
5. Constraint có thể thay đổi (nhưng tổng power tương đương)
6. Player phải cảm thấy "tiến hóa" chứ không phải "mất mát"
7. Output ONLY valid JSON, no markdown, no explanation"""

_MUTATION_USER_TEMPLATE = """\
## Original Skill:
- Name: {name}
- Principle: {principle}
- Tier: {tier}
- Mechanic: {mechanic}
- Limitation: {limitation}
- Weakness: {weakness}

## Player Identity (current vs seed):
Seed principle resonance: {seed_resonance}
Current principle resonance: {current_resonance}
Drift direction: {drift_direction}

## Mutation Type: {mutation_type}

## Mutation Type Descriptions:
- inversion: Skill's principle shifts to its OPPOSITE
- corruption: Skill becomes stronger but gains backlash/instability risk
- purification: Skill sheds constraints, becomes cleaner/simpler
- hybridization: Skill gains a SECOND principle from latent identity

## Output JSON:
{{"name": "New skill name", "primary_principle": "principle (may change for inversion)", \
"mechanic": "New mechanic description", "limitation": "New constraint", \
"weakness": "New weakness", "mutation_narrative": "1 sentence explaining why the skill changed"}}"""


# ══════════════════════════════════════════════
# Hybrid Skill Generation (§4.6.1)
# ══════════════════════════════════════════════

_HYBRID_SYSTEM_PROMPT = """\
You are the skill evolution designer for a dark-fantasy isekai RPG called Amoisekai.

Your job: create a HYBRID version of an existing combat skill. The player has
forced BOTH their old and new identity natures into one skill. This is risky
and powerful — the skill should reflect internal conflict becoming strength.

CRITICAL RULES:
1. Skill PHẢI phản ánh CẢ HAI identity (current + latent)
2. Tên: phản ánh dual-nature (VD: "Matter-Flux Adaptive Shield")
3. Mechanic: kết hợp gốc + yếu tố mới, tạo dual behavior
4. Giữ cùng Tier ({tier})
5. Constraint: TĂNG (hybrid = mạnh nhưng phức tạp hơn, instability risk)
6. Weakness: dễ bị disrupt vì bản chất nội tại xung đột
7. Output ONLY valid JSON, no markdown, no explanation"""

_HYBRID_USER_TEMPLATE = """\
## Original Skill:
- Name: {name}
- Principle: {principle}
- Tier: {tier}
- Mechanic: {mechanic}
- Limitation: {limitation}

## Player Identity:
Current dominant: {current_identity}
Latent force: {latent_identity}

## Output JSON:
{{"name": "Hybrid skill name", "primary_principle": "{principle}", \
"secondary_principle": "New principle from latent", \
"mechanic": "Dual-behavior mechanic", "limitation": "Heavier constraint than original", \
"weakness": "Dual-nature instability weakness", \
"hybrid_narrative": "1 sentence explaining the dual nature"}}"""


# ══════════════════════════════════════════════
# Integration Skill Generation (§5.4)
# ══════════════════════════════════════════════

_INTEGRATION_SYSTEM_PROMPT = """\
You are the skill evolution designer for a dark-fantasy isekai RPG called Amoisekai.

Your job: merge TWO combat skills into ONE higher-tier skill. The merged skill
should feel like two familiar powers becoming something greater together.

CRITICAL RULES:
1. New skill must combine the ESSENCE of both source skills
2. Name: reflects the merger (2-3 words, English, evocative)
3. Mechanic: fusion of both mechanics, more versatile
4. Output Tier: {output_tier} (higher than inputs)
5. Principles: use all merged principles: {merged_principles}
6. Constraint should be balanced — more powerful but reasonable limits
7. Player should feel "evolution" not "loss"
8. Output ONLY valid JSON, no markdown, no explanation"""

_INTEGRATION_USER_TEMPLATE = """\
## Skill A:
- Name: {name_a}
- Principle: {principle_a}
- Tier: {tier_a}
- Mechanic: {mechanic_a}
- Limitation: {limitation_a}

## Skill B:
- Name: {name_b}
- Principle: {principle_b}
- Tier: {tier_b}
- Mechanic: {mechanic_b}
- Limitation: {limitation_b}

## Output Tier: {output_tier}
## Merged Principles: {merged_principles}

## Output JSON:
{{"name": "Merged skill name", "primary_principle": "dominant principle", \
"secondary_principle": "secondary (if dual)", \
"tier": {output_tier}, "mechanic": "Fused mechanic", \
"limitation": "New constraint", "weakness": "New weakness", \
"integration_narrative": "1 sentence describing the fusion"}}"""


# ══════════════════════════════════════════════
# Core Generation Functions
# ══════════════════════════════════════════════

def _make_llm(temperature: float = 0.7):
    """Create LLM for skill evolution generation."""
    from langchain_google_genai import ChatGoogleGenerativeAI
    return ChatGoogleGenerativeAI(
        model=settings.writer_model,
        temperature=temperature,
        api_key=settings.google_api_key,
    )


def _parse_json_response(raw: str) -> dict:
    """Parse LLM response as JSON, stripping markdown fences if present."""
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3].strip()
    return json.loads(raw)


async def generate_mutated_skill(
    original_skill: dict,
    mutation_type: str,
    current_resonance: dict[str, float],
    seed_resonance: dict[str, float] | None = None,
    drift_direction: str = "",
    llm: Any = None,
) -> dict:
    """Generate a mutated version of a skill via LLM.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §4.6

    Args:
        original_skill: The skill dict being mutated.
        mutation_type: "inversion" | "corruption" | "purification" | "hybridization"
        current_resonance: Player's current resonance dict.
        seed_resonance: Player's original seed resonance (optional).
        drift_direction: Description of how identity drifted.
        llm: Optional LLM instance (uses default if None).

    Returns:
        Dict with generated mutated skill fields.
    """
    if llm is None:
        llm = _make_llm()

    tier = original_skill.get("tier", 1)
    system = _MUTATION_SYSTEM_PROMPT.format(tier=tier)
    user = _MUTATION_USER_TEMPLATE.format(
        name=original_skill.get("name", "Unknown"),
        principle=original_skill.get("primary_principle", ""),
        tier=tier,
        mechanic=original_skill.get("mechanic", ""),
        limitation=original_skill.get("limitation", ""),
        weakness=original_skill.get("weakness", ""),
        seed_resonance=json.dumps(seed_resonance or {}, ensure_ascii=False),
        current_resonance=json.dumps(current_resonance, ensure_ascii=False),
        drift_direction=drift_direction or "general identity drift",
        mutation_type=mutation_type,
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user),
        ])
        result = _parse_json_response(response.content)
        result["tier"] = tier  # Enforce same tier
        result["evolution_type"] = "mutation"
        result["mutation_type"] = mutation_type
        logger.info("AI mutation generated: %s → %s", original_skill.get("name"), result.get("name"))
        return result
    except Exception as exc:
        logger.warning("AI mutation generation failed: %s — using fallback", exc)
        return _fallback_mutation(original_skill, mutation_type)


async def generate_hybrid_skill(
    original_skill: dict,
    current_identity: str,
    latent_identity: str,
    llm: Any = None,
) -> dict:
    """Generate a hybrid skill via LLM.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §4.6.1

    Args:
        original_skill: The skill dict being hybridized.
        current_identity: Description of player's current identity.
        latent_identity: Description of player's latent identity.
        llm: Optional LLM instance.

    Returns:
        Dict with generated hybrid skill fields.
    """
    if llm is None:
        llm = _make_llm()

    tier = original_skill.get("tier", 1)
    system = _HYBRID_SYSTEM_PROMPT.format(tier=tier)
    user = _HYBRID_USER_TEMPLATE.format(
        name=original_skill.get("name", "Unknown"),
        principle=original_skill.get("primary_principle", ""),
        tier=tier,
        mechanic=original_skill.get("mechanic", ""),
        limitation=original_skill.get("limitation", ""),
        current_identity=current_identity,
        latent_identity=latent_identity,
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user),
        ])
        result = _parse_json_response(response.content)
        result["tier"] = tier
        result["evolution_type"] = "hybrid"
        logger.info("AI hybrid generated: %s → %s", original_skill.get("name"), result.get("name"))
        return result
    except Exception as exc:
        logger.warning("AI hybrid generation failed: %s — using fallback", exc)
        return _fallback_hybrid(original_skill, latent_identity)


async def generate_integrated_skill(
    skill_a: dict,
    skill_b: dict,
    output_tier: int,
    merged_principles: list[str],
    llm: Any = None,
) -> dict:
    """Generate an integrated skill via LLM.

    Ref: SKILL_EVOLUTION_SPEC v1.1 §5.4

    Args:
        skill_a: First source skill dict.
        skill_b: Second source skill dict.
        output_tier: Calculated output tier (2 or 3).
        merged_principles: Combined principle list.
        llm: Optional LLM instance.

    Returns:
        Dict with generated integrated skill fields.
    """
    if llm is None:
        llm = _make_llm()

    principles_str = ", ".join(merged_principles)
    system = _INTEGRATION_SYSTEM_PROMPT.format(
        output_tier=output_tier,
        merged_principles=principles_str,
    )
    user = _INTEGRATION_USER_TEMPLATE.format(
        name_a=skill_a.get("name", "Unknown A"),
        principle_a=skill_a.get("primary_principle", ""),
        tier_a=skill_a.get("tier", 1),
        mechanic_a=skill_a.get("mechanic", ""),
        limitation_a=skill_a.get("limitation", ""),
        name_b=skill_b.get("name", "Unknown B"),
        principle_b=skill_b.get("primary_principle", ""),
        tier_b=skill_b.get("tier", 1),
        mechanic_b=skill_b.get("mechanic", ""),
        limitation_b=skill_b.get("limitation", ""),
        output_tier=output_tier,
        merged_principles=principles_str,
    )

    try:
        response = await llm.ainvoke([
            SystemMessage(content=system),
            HumanMessage(content=user),
        ])
        result = _parse_json_response(response.content)
        result["tier"] = output_tier
        result["evolution_type"] = "integration"
        result["merged_from"] = [skill_a.get("id", ""), skill_b.get("id", "")]
        logger.info(
            "AI integration generated: %s + %s → %s",
            skill_a.get("name"), skill_b.get("name"), result.get("name"),
        )
        return result
    except Exception as exc:
        logger.warning("AI integration generation failed: %s — using fallback", exc)
        return _fallback_integration(skill_a, skill_b, output_tier, merged_principles)


# ══════════════════════════════════════════════
# Fallbacks (deterministic, no AI)
# ══════════════════════════════════════════════

def _fallback_mutation(original: dict, mutation_type: str) -> dict:
    """Deterministic fallback when AI is unavailable."""
    name = original.get("name", "Unknown")
    principle = original.get("primary_principle", "")

    type_prefix = {
        "inversion": "Inverted",
        "corruption": "Unstable",
        "purification": "Purified",
        "hybridization": "Hybrid",
    }.get(mutation_type, "Mutated")

    return {
        "name": f"{type_prefix} {name}",
        "primary_principle": principle,
        "tier": original.get("tier", 1),
        "mechanic": f"Mutated form of {original.get('mechanic', 'unknown mechanic')}",
        "limitation": original.get("limitation", ""),
        "weakness": original.get("weakness", ""),
        "mutation_narrative": f"Identity drift caused {name} to {mutation_type}.",
        "evolution_type": "mutation",
        "mutation_type": mutation_type,
    }


def _fallback_hybrid(original: dict, latent: str) -> dict:
    """Deterministic fallback for hybrid skill."""
    name = original.get("name", "Unknown")
    return {
        "name": f"Hybrid {name}",
        "primary_principle": original.get("primary_principle", ""),
        "secondary_principle": latent,
        "tier": original.get("tier", 1),
        "mechanic": f"Dual-nature form of {original.get('mechanic', 'unknown')}",
        "limitation": f"Heavier constraint: {original.get('limitation', 'unknown')}",
        "weakness": "Internal principle conflict causes instability",
        "hybrid_narrative": f"{name} struggles to hold two natures.",
        "evolution_type": "hybrid",
    }


def _fallback_integration(
    skill_a: dict, skill_b: dict,
    output_tier: int, merged_principles: list[str],
) -> dict:
    """Deterministic fallback for integrated skill."""
    name_a = skill_a.get("name", "A")
    name_b = skill_b.get("name", "B")
    return {
        "name": f"{name_a}-{name_b} Fusion",
        "primary_principle": merged_principles[0] if merged_principles else "",
        "secondary_principle": merged_principles[1] if len(merged_principles) > 1 else "",
        "tier": output_tier,
        "mechanic": f"Fusion of {skill_a.get('mechanic', '')} and {skill_b.get('mechanic', '')}",
        "limitation": "Merged constraint from both source skills",
        "weakness": "Complex dual-origin vulnerability",
        "integration_narrative": f"{name_a} and {name_b} merged into something greater.",
        "evolution_type": "integration",
        "merged_from": [skill_a.get("id", ""), skill_b.get("id", "")],
    }
