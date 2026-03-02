"""Ledger Extractor — extract new named entities and facts from generated prose.

Uses a light LLM call (low temperature, structured JSON output).
Runs asynchronously and non-blocking — extraction happens after chapter delivery.

Design principles:
- Best-effort: failure returns empty lists, never raises
- False positive tolerance: better to extract too little than hallucinate facts
- Token cap: prose is truncated to 3000 chars to control cost
- Only extracts NAMED entities (proper nouns), not generic descriptions
"""

from __future__ import annotations

import json
import logging
import re

from app.models.story_ledger import EstablishedFact, IntroducedEntity, StoryLedger

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Extraction prompt
# ──────────────────────────────────────────────

_EXTRACTION_SYSTEM = """Bạn là hệ thống trích xuất dữ kiện narrative tự động.
Nhiệm vụ: phân tích đoạn văn và trích xuất entities có tên riêng + facts quan trọng.

QUY TẮC CHÍNH:
- CHỈ extract entity có TÊN RIÊNG (proper noun) — KHÔNG extract "một người lính", "căn nhà"
- CHỈ extract facts có thể gây contradiction nếu AI quên
- KHÔNG extract cảm xúc, dialogue thông thường, mô tả không khí
- Output chỉ JSON, không giải thích

PHÂN LOẠI entity_type:
- npc: người có tên (không phải Emissary/General đã trong canon)
- location: địa điểm có tên riêng không trong canonical registry
- object: vật phẩm có tên riêng quan trọng
- group: nhóm/tổ chức có tên riêng
- event: sự kiện lịch sử có tên riêng được nhắc đến"""

_EXTRACTION_USER = """STORY LEDGER HIỆN TẠI (entities đã được track — không extract lại):
{current_ledger_summary}

CANONICAL ENTITIES (không extract — đã có trong world registry):
{canonical_entity_list}

CHAPTER {chapter_number} TEXT:
{chapter_text}

Output JSON:
{{
  "new_entities": [
    {{
      "entity_id": "slug_lowercase_underscore",
      "entity_type": "npc|location|object|group|event",
      "name": "Tên Chính Xác Như Trong Text",
      "description_anchor": "1-2 câu mô tả cố định về entity này",
      "current_status": "active"
    }}
  ],
  "new_facts": [
    {{
      "fact_id": "slug_id",
      "statement": "Phát biểu ngắn về sự thật world này",
      "entity_ids_involved": ["entity_id_nếu_có"]
    }}
  ]
}}

Nếu không có gì để extract: {{"new_entities": [], "new_facts": []}}"""


# ──────────────────────────────────────────────
# Canonical entity list (data-driven from entity_registry.yaml)
# ──────────────────────────────────────────────

def _build_canonical_entity_list() -> str:
    """Build compact canonical entity names list from entity_registry.yaml.

    Result is used in the extraction prompt to prevent re-extracting
    entities that are already in the canonical registry.

    Falls back to a hardcoded summary if entity_registry is unavailable.
    """
    try:
        from app.world.entity_registry import _load_registry
        registry = _load_registry()

        npcs = [n["name"] for n in registry.get("npcs", [])]
        emissaries = [e["name"] for e in registry.get("emissaries", [])]
        generals = [g["name"] for g in registry.get("generals", [])]
        locations = [loc["name"] for loc in registry.get("locations", [])]

        parts = []
        if npcs:
            parts.append(f"NPCs: {', '.join(npcs)}")
        if emissaries:
            parts.append(f"Emissaries: {', '.join(emissaries)}")
        if generals:
            parts.append(f"Generals: {', '.join(generals)}")
        if locations:
            parts.append(f"Locations: {', '.join(locations)}")

        return " | ".join(parts) if parts else "Xem entity_registry.yaml"
    except Exception:
        # Hardcoded fallback — kept in sync manually as last resort
        return (
            "NPCs: Sel, Veth | Emissaries: Kaen, Sira, Thol | Generals: Vorn, Kha, Mireth, Azen"
            " | Locations: Grand Gate City, Outer Corruption Zone, Tower Floor 1/2/3"
        )


# ──────────────────────────────────────────────
# Public extraction function
# ──────────────────────────────────────────────

async def extract_from_chapter(
    prose: str,
    chapter_number: int,
    current_ledger: StoryLedger,
    llm,
) -> tuple[list[IntroducedEntity], list[EstablishedFact]]:
    """Extract new entities and facts from a generated chapter.

    Args:
        prose: Generated chapter prose
        chapter_number: Current chapter number
        current_ledger: Existing ledger (to avoid re-extracting known entities)
        llm: LLM instance (low temperature recommended)

    Returns:
        Tuple of (new_entities, new_facts). Both empty on failure.
    """
    if not prose or not prose.strip():
        return [], []

    try:
        from langchain_core.messages import HumanMessage, SystemMessage

        # Build compact ledger summary for the prompt
        existing_names = [e.name for e in current_ledger.introduced_entities[:20]]
        ledger_summary = (
            ", ".join(existing_names) if existing_names
            else "Chưa có entities nào"
        )

        user_content = _EXTRACTION_USER.format(
            current_ledger_summary=ledger_summary,
            canonical_entity_list=_build_canonical_entity_list(),
            chapter_number=chapter_number,
            chapter_text=prose[:3000],  # cap to control token usage
        )

        messages = [
            SystemMessage(content=_EXTRACTION_SYSTEM),
            HumanMessage(content=user_content),
        ]

        response = await llm.ainvoke(messages)
        raw = response.content if hasattr(response, "content") else str(response)

        # Parse JSON
        data = _parse_extraction_json(raw)
        if not data:
            return [], []

        entities: list[IntroducedEntity] = []
        for e in data.get("new_entities", []):
            try:
                entity_id = e.get("entity_id") or StoryLedger.make_slug(e.get("name", ""))
                if not entity_id:
                    continue
                entities.append(IntroducedEntity(
                    entity_id=entity_id,
                    entity_type=e.get("entity_type", "npc"),
                    name=e.get("name", ""),
                    first_appeared_chapter=chapter_number,
                    description_anchor=e.get("description_anchor", ""),
                    current_status=e.get("current_status", "active"),
                ))
            except Exception as entity_err:
                logger.debug(f"Extraction: skip malformed entity: {entity_err}")
                continue

        facts: list[EstablishedFact] = []
        for f in data.get("new_facts", []):
            try:
                fact_id = f.get("fact_id") or StoryLedger.make_slug(f.get("statement", "")[:30])
                if not fact_id or not f.get("statement"):
                    continue
                facts.append(EstablishedFact(
                    fact_id=fact_id,
                    statement=f.get("statement", ""),
                    chapter_established=chapter_number,
                    source="ai_generated",
                    entity_ids_involved=f.get("entity_ids_involved", []),
                ))
            except Exception as fact_err:
                logger.debug(f"Extraction: skip malformed fact: {fact_err}")
                continue

        logger.info(
            f"Ledger extraction ch.{chapter_number}: "
            f"{len(entities)} entities, {len(facts)} facts"
        )
        return entities, facts

    except Exception as e:
        logger.warning(f"Ledger extraction failed (ch.{chapter_number}): {e} — continuing")
        return [], []


# ──────────────────────────────────────────────
# JSON parsing helper
# ──────────────────────────────────────────────

def _parse_extraction_json(raw: str) -> dict | None:
    """Parse extraction JSON with markdown fence stripping."""
    text = raw.strip()

    # Strip markdown fences
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

    # Find first { ... } block
    if not text.startswith("{"):
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            text = match.group(0)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.debug(f"Extraction JSON parse failed: {text[:200]}")
        return None
