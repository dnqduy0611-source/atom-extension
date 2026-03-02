"""Agent 3: Context — builds rich context from pipeline state for the writer.

Injects (in order):
  0.  NeuralMemory semantic recall (story_brain.py)
  0b. Story Ledger (per-story accumulated entities + facts)
  0c. World State (Phase 3: Emissary/Tower/flags/threat pressure)
  1-9. Simulator output + player identity + unique skill
"""

from __future__ import annotations

import logging

from app.models.pipeline import NarrativeState

logger = logging.getLogger(__name__)


async def run_context(state: NarrativeState, db: object = None) -> dict:
    """Build context string from pipeline state and chapter history.

    Strategy:
    1. NeuralMemory semantic query (recalled memories from past chapters)
    2. Previous summary + chosen choice continuity bridge
    3. Simulator consequences, NPC reactions, world state
    4. Player identity + unique skill

    Returns dict with 'context' key.
    """
    contexts: list[str] = []

    # ── 0. NeuralMemory semantic recall ──
    story_id = getattr(state, "story_id", None)
    if story_id:
        try:
            from app.memory.story_brain import get_or_create_brain
            brain = await get_or_create_brain(story_id)
            if brain.available:
                query = _build_memory_query(state)
                memory_ctx = await brain.query_context(query, max_tokens=800)
                if memory_ctx:
                    contexts.append(memory_ctx)
                    logger.info(f"Context: NeuralMemory recalled {len(memory_ctx)} chars")
        except Exception as e:
            logger.warning(f"Context: NeuralMemory query failed ({e}) — continuing")

    # ── 0b. Story Ledger injection ──
    # Inject per-player accumulated facts to ensure AI consistency
    if story_id:
        try:
            from app.memory.ledger_store import load_ledger
            ledger = load_ledger(story_id)
            ledger_block = ledger.to_prompt_string(max_chars=1000)
            if ledger_block:
                contexts.append(ledger_block)
                logger.info(
                    f"Context: Story Ledger injected "
                    f"({ledger.entity_count()} entities, {ledger.fact_count()} facts)"
                )
        except Exception as e:
            logger.warning(f"Context: Story Ledger inject failed ({e}) — continuing")

    # ── 0c. World State injection ──
    # Inject dynamic world state: threat pressure, emissary reveals, tower, world flags
    if story_id:
        try:
            from app.memory.world_state_store import load_world_state
            world_state = load_world_state(story_id)
            ws_block = world_state.to_prompt_string()
            # to_prompt_string() returns "" if nothing notable (has_notable_state == False)
            if ws_block:
                contexts.append(ws_block)
                logger.info(
                    f"Context: WorldState injected "
                    f"(pressure={world_state.get_threat_pressure()}, "
                    f"flags={len([k for k,v in world_state.world_flags.items() if v])})"
                )

            # ── 0d. Villain context injection ──
            try:
                from app.narrative.villain_tracker import get_villain_context
                villain_block = get_villain_context(world_state)
                if villain_block:
                    contexts.append(villain_block)
                    logger.info("Context: Villain context injected")
            except Exception as ve:
                logger.warning(f"Context: Villain context failed ({ve}) — continuing")

        except Exception as e:
            logger.warning(f"Context: WorldState inject failed ({e}) — continuing")

    # ── 0e. Companion context injection ──
    # Uses module-level lazy singleton — no db argument needed.
    if story_id:
        try:
            from app.narrative.companion_context import load_companion_context
            preference_tags = getattr(state, "preference_tags", []) or []
            tone = getattr(state, "tone", "") or ""
            # Extract player_gender if available (Phase 3; default neutral)
            player_gender = getattr(state, "player_gender", "neutral") or "neutral"
            companion_block = load_companion_context(
                story_id=story_id,
                preference_tags=preference_tags,
                tone=tone,
                player_gender=player_gender,
            )
            if companion_block:
                contexts.append(companion_block)
                logger.info("Context: Companion context injected")
        except Exception as e:
            logger.warning(f"Context: Companion context inject failed ({e}) — continuing")

    # ── 1. Previous Summary (chapter history) ──
    if state.previous_summary:
        contexts.append(f"## Tóm tắt trước đó:\n{state.previous_summary}")

    # ── 1b. Previous chapter ending prose (cross-chapter continuity bridge) ──
    # The actual final scene prose from chapter N-1, so chapter N opens consistently
    prev_ending = getattr(state, "previous_chapter_ending", "")
    if prev_ending:
        # Truncate to last ~600 chars to keep context lean but contextually rich
        snippet = prev_ending[-600:] if len(prev_ending) > 600 else prev_ending
        contexts.append(
            f"## Cảnh kết chương trước (bắt buộc duy trì liên kết):\n"
            f"{snippet}\n\n"
            f"⚠️ QUAN TRỌNG: Chương mới phải mở đầu nhất quán với cảnh trên — "
            f"NPC hiện diện, địa điểm, cảm xúc và tension phải liên tục. "
            f"Không đột ngột reset bối cảnh."
        )
        logger.info(f"Context: previous_chapter_ending injected ({len(snippet)} chars)")

    # ── 2. Continuity Bridge: chosen_choice → next chapter ──
    if state.chosen_choice:
        choice = state.chosen_choice
        choice_text = ""
        if isinstance(choice, dict):
            choice_text = choice.get("text", "")
        elif hasattr(choice, "text"):
            choice_text = choice.text or ""
        if choice_text:
            contexts.append(
                f"## Lựa chọn player vừa đưa ra:\n"
                f"→ \"{choice_text}\"\n"
                f"QUAN TRỌNG: Chương này PHẢI bắt đầu từ hậu quả trực tiếp "
                f"của lựa chọn trên. Không bỏ qua."
            )

    # Free input continuity
    if state.free_input:
        contexts.append(
            f"## Hành động tự do của player:\n"
            f"→ \"{state.free_input}\"\n"
            f"Tích hợp hành động này vào narrative một cách tự nhiên."
        )

    # ── 3. Simulator — relationship changes ──
    if state.simulator_output:
        sim = state.simulator_output
        if sim.relationship_changes:
            rel_text = "\n".join(
                f"- {_safe_get(r, 'from_char', '?')} → {_safe_get(r, 'to_char', '?')}: "
                f"{_safe_get(r, 'new_relation', '?')} ({_safe_get(r, 'reason', '')})"
                for r in sim.relationship_changes
            )
            if rel_text:
                contexts.append(f"## Mối quan hệ thay đổi:\n{rel_text}")

        # ── 4. Character reactions ──
        if sim.character_reactions:
            react_text = "\n".join(
                f"- {_safe_get(r, 'character', '?')}: "
                f"{_safe_get(r, 'reaction', '')} "
                f"(vì {_safe_get(r, 'motivation', 'không rõ')})"
                for r in sim.character_reactions
            )
            if react_text:
                contexts.append(f"## Phản ứng NPC:\n{react_text}")

        # ── 5. Consequences ──
        if sim.consequences:
            cons_text = "\n".join(
                f"- {_safe_get(c, 'description', '')} "
                f"[{_safe_get(c, 'severity', 'moderate')}]"
                for c in sim.consequences
            )
            if cons_text:
                contexts.append(f"## Hậu quả từ chương trước:\n{cons_text}")

        # ── 6. World state changes ──
        if sim.world_state_updates:
            world_text = "\n".join(f"- {w}" for w in sim.world_state_updates if isinstance(w, str))
            if world_text:
                contexts.append(f"## Thay đổi thế giới:\n{world_text}")

        # ── 7. Foreshadowing ──
        if sim.foreshadowing:
            foreshadow_text = "\n".join(f"- {f}" for f in sim.foreshadowing if isinstance(f, str))
            if foreshadow_text:
                contexts.append(f"## Gợi ý tương lai:\n{foreshadow_text}")

        # ── 7b. Causal Chains (Consequence Router) ──
        causal_chains = getattr(sim, "causal_chains", [])
        if causal_chains:
            chain_parts = []
            for chain in causal_chains[:3]:  # max 3 chains
                cid = _safe_get(chain, "id", "?")
                trigger = _safe_get(chain, "trigger", "")
                links = chain.links if hasattr(chain, "links") else chain.get("links", []) if isinstance(chain, dict) else []
                horizon = _safe_get(chain, "horizon", "immediate")
                cascade = _safe_get(chain, "cascade_risk", "low")
                chain_text = f"- [{cid}] {trigger} ({horizon}, cascade={cascade})"
                if links:
                    chain_text += "\n" + "\n".join(f"  → {link}" for link in links)
                chain_parts.append(chain_text)
            if chain_parts:
                contexts.append(
                    "## Chuỗi nhân-quả (Consequence Router):\n"
                    + "\n".join(chain_parts)
                )

        # ── 7c. Writer Guidance (soft instruction from Consequence Router) ──
        writer_guidance = getattr(sim, "writer_guidance", None)
        if writer_guidance:
            wg_parts = []
            tone = _safe_get(writer_guidance, "tone", "")
            if tone and tone != "neutral":
                wg_parts.append(f"- Tone gợi ý: {tone}")
            foreshadow_priority = _safe_get(writer_guidance, "foreshadow_priority", "")
            if foreshadow_priority:
                wg_parts.append(f"- Foreshadow ưu tiên: {foreshadow_priority}")
            skill_note = _safe_get(writer_guidance, "unique_skill_narrative_note", "")
            if skill_note:
                wg_parts.append(f"- Unique Skill note: {skill_note}")
            pacing = _safe_get(writer_guidance, "pacing_note", "")
            if pacing:
                wg_parts.append(f"- Pacing: {pacing}")
            if wg_parts:
                contexts.append(
                    "## Writer Guidance (soft — không bắt buộc):\n"
                    + "\n".join(wg_parts)
                )

    # ── 8. Player identity context ──
    if state.player_state:
        player = state.player_state
        id_parts = []
        if isinstance(player, dict):
            ci = player.get("current_identity", {})
            li = player.get("latent_identity", {})
            rep_tags = ci.get("reputation_tags", []) if isinstance(ci, dict) else []
            drift_dir = li.get("drift_direction", "") if isinstance(li, dict) else ""
            active_vals = ci.get("active_values", []) if isinstance(ci, dict) else []
            active_traits = ci.get("active_traits", []) if isinstance(ci, dict) else []
        else:
            ci = getattr(player, "current_identity", None)
            li = getattr(player, "latent_identity", None)
            rep_tags = getattr(ci, "reputation_tags", []) if ci else []
            drift_dir = getattr(li, "drift_direction", "") if li else ""
            active_vals = getattr(ci, "active_values", []) if ci else []
            active_traits = getattr(ci, "active_traits", []) if ci else []
        if active_vals:
            id_parts.append(f"Giá trị: {', '.join(active_vals)}")
        if active_traits:
            id_parts.append(f"Tính cách: {', '.join(active_traits)}")
        if rep_tags:
            id_parts.append(f"Danh tiếng: {', '.join(rep_tags)}")
        if drift_dir:
            id_parts.append(f"Xu hướng ẩn: {drift_dir}")
        if id_parts:
            contexts.append(f"## Player Identity:\n" + "\n".join(f"- {p}" for p in id_parts))

    # ── 9. Unique Skill context ──
    if state.player_state:
        skill = _extract_skill(state.player_state)
        if skill:
            skill_ctx = (
                f"## Unique Skill — {skill.get('name', '?')}:\n"
                f"- Mô tả: {skill.get('description', '')}\n"
                f"- Cơ chế: {skill.get('mechanic', '')}\n"
                f"- Kích hoạt: {skill.get('activation_condition', '')}\n"
                f"- Giới hạn: {skill.get('limitation', '')}"
            )
            contexts.append(skill_ctx)

    # ── 9b. Player Gender Context (Phase 3) ──
    player_gender = getattr(state, "player_gender", "neutral") or "neutral"
    preference_tags = getattr(state, "preference_tags", []) or []
    tone = getattr(state, "tone", "") or ""
    if player_gender in ("male", "female"):
        gender_block = _build_gender_context(player_gender, preference_tags, tone)
        if gender_block:
            gender_label = {"male": "nam", "female": "nữ"}.get(player_gender, "")
            contexts.append(f"## Player Gender: {gender_label}\n{gender_block}")

    context_str = "\n\n---\n\n".join(contexts) if contexts else "Không có context bổ sung."

    logger.info(f"Context: built {len(contexts)} context blocks ({len(context_str)} chars)")

    return {"context": context_str}


def _build_memory_query(state: NarrativeState) -> str:
    """Build a semantic query for NeuralMemory from current pipeline state."""
    parts = []

    name = state.protagonist_name or "nhân vật chính"
    chapter = state.chapter_number or 0
    parts.append(f"Chương {chapter} — {name}")

    if state.chosen_choice:
        choice = state.chosen_choice
        text = choice.get("text", "") if isinstance(choice, dict) else getattr(choice, "text", "")
        if text:
            parts.append(f"Hành động: {text}")

    if state.player_state:
        player = state.player_state
        archetype = (
            player.get("archetype") if isinstance(player, dict)
            else getattr(player, "archetype", "")
        )
        if archetype:
            parts.append(f"Archetype: {archetype}")

    if state.planner_output:
        planner = state.planner_output
        beats = getattr(planner, "beats", [])
        if beats:
            first_beat = beats[0]
            desc = (
                first_beat.get("description", "") if isinstance(first_beat, dict)
                else getattr(first_beat, "description", "")
            )
            if desc:
                parts.append(desc[:100])

    return " | ".join(parts) if parts else f"Chương {chapter}"


def _safe_get(obj: object, key: str, default: str = "") -> str:
    """Safely get a string value from a dict or Pydantic model."""
    if isinstance(obj, dict):
        return str(obj.get(key, default))
    return str(getattr(obj, key, default))


def _extract_skill(player: object) -> dict | None:
    """Extract unique_skill dict from player (dict or Pydantic model)."""
    skill = None
    if isinstance(player, dict):
        skill = player.get("unique_skill")
    else:
        skill = getattr(player, "unique_skill", None)
    if skill is None:
        return None
    if isinstance(skill, dict):
        return skill
    if hasattr(skill, "model_dump"):
        return skill.model_dump()
    return None


def _build_gender_context(
    gender: str,
    preference_tags: list[str],
    tone: str,
) -> str:
    """Build gender-aware NPC dynamic guidance for the Writer.

    Returns a multi-line string injected into Writer context block 9b.
    Accounts for:
      - player gender (male / female)
      - preference_tags (cultivation, wuxia, fantasy, isekai, modern, ...)
      - tone (dark, comedy, romance, slice_of_life, epic, mysterious)

    COMPANION_VILLAIN_GENDER_SPEC §3.2–§3.3
    """
    tags = [t.lower() for t in (preference_tags or [])]
    tone = (tone or "").lower()

    is_cultivation = any(t in tags for t in ("cultivation", "wuxia", "xianxia", "tu_tien"))
    is_fantasy = any(t in tags for t in ("fantasy", "isekai", "magic", "phep_thuat"))
    is_modern = any(t in tags for t in ("modern", "hien_dai", "urban"))
    is_romance = "romance" in tags or tone == "romance"
    is_dark = tone == "dark"
    is_comedy = tone == "comedy"

    lines: list[str] = []

    if gender == "male":
        # ── Address forms by setting ──
        if is_cultivation:
            lines.append(
                "- Cách xưng hô với player nam:\n"
                "  • NPC tiền bối/có quyền lực: 'thiếu hiệp', 'cậu bé', 'huynh đệ', 'hiền huynh'\n"
                "  • NPC đồng đẳng: 'đạo hữu', 'huynh', 'huynh đài'\n"
                "  • NPC kẻ thù: 'ngươi', 'hắn ta', 'tên kia' — đối kháng trực tiếp\n"
                "  • Cultivation setting formal: 'đạo hữu' khi tôn trọng, 'ngươi' khi thù địch"
            )
        elif is_fantasy:
            lines.append(
                "- Cách xưng hô với player nam:\n"
                "  • NPC tiền bối: 'cậu', 'chiến sĩ trẻ', 'dũng sĩ'\n"
                "  • NPC đồng đẳng: 'bạn', 'cậu', 'huynh'\n"
                "  • NPC kẻ thù: 'ngươi', 'kẻ kia', thẳng thắn hơn\n"
                "  • Authority: thử thách trực tiếp, ít protective"
            )
        elif is_modern:
            lines.append(
                "- Cách xưng hô với player nam:\n"
                "  • NPC casual: 'cậu', 'anh', 'bạn'\n"
                "  • NPC lớn tuổi: 'cháu', 'em', 'anh'\n"
                "  • NPC kẻ thù: 'mày', 'anh ta', lạnh\n"
                "  • Authority: thẳng thắn, kiểm tra năng lực"
            )
        else:
            lines.append(
                "- Cách xưng hô với player nam:\n"
                "  • NPC tiền bối: 'cậu', 'huynh', tôn trọng khả năng\n"
                "  • NPC kẻ thù: 'ngươi', trực tiếp\n"
                "  • Authority: thử thách trực tiếp, ít protective"
            )
        lines.append(
            "- Social dynamics:\n"
            "  • Authority NPCs test player bằng thách thức trực tiếp — không protective\n"
            "  • Enemy NPCs đánh giá đúng sức mạnh, combat thẳng thắn\n"
            "  • Companion nữ: peer dynamic, bình tĩnh khi player hấp tấp"
        )
        if is_romance:
            lines.append(
                "- Romance layer (tag: romance):\n"
                "  • NPC nữ tương thích: classic romantic tension, tránh nhìn thẳng, hay tranh luận nhỏ để giữ khoảng cách\n"
                "  • Khoảnh khắc bình thường được nâng tầm (Makoto Shinkai style)\n"
                "  • NPC nam tương thích: bromance → subtext, rivalry trước khi mutual respect"
            )

    elif gender == "female":
        # ── Address forms by setting ──
        if is_cultivation:
            lines.append(
                "- Cách xưng hô với player nữ:\n"
                "  • NPC tiền bối progressive: 'tiên tử', 'đạo hữu', tôn trọng sức mạnh\n"
                "  • NPC tiền bối truyền thống: 'cô nương', 'muội', 'tiểu muội' — bày tỏ surprise khi player mạnh\n"
                "  • NPC đồng đẳng: 'đạo hữu', 'muội đài', 'tiên tử' nếu được công nhận\n"
                "  • NPC kẻ thù: 'ngươi', một số underestimate: 'thư nữ kia', 'tiểu nữ' → tạo dramatic irony\n"
                "  • NPC nữ đồng đẳng: solidarity tự nhiên, 'muội', 'tỷ'"
            )
        elif is_fantasy:
            lines.append(
                "- Cách xưng hô với player nữ:\n"
                "  • NPC tiền bối: 'cô gái', 'chiến sĩ', tùy archetype NPC\n"
                "  • NPC progressive: tôn trọng kỹ năng, không phân biệt\n"
                "  • NPC kẻ thù: một số underestimate, tạo opening khi player exploit\n"
                "  • NPC nữ đồng đẳng: shared understanding tự nhiên"
            )
        elif is_modern:
            lines.append(
                "- Cách xưng hô với player nữ:\n"
                "  • NPC casual: 'cô', 'chị', 'bạn'\n"
                "  • NPC lớn tuổi: 'cháu', 'em', 'cô'\n"
                "  • NPC kẻ thù: 'cô ta', 'mày', dismissive"
            )
        else:
            lines.append(
                "- Cách xưng hô với player nữ:\n"
                "  • NPC tiền bối: 'cô', 'cô gái', protective hoặc dismissive tùy archetype\n"
                "  • NPC kẻ thù: 'ngươi', một số underestimate → dramatic irony\n"
                "  • NPC nữ đồng đẳng: solidarity ngầm"
            )
        lines.append(
            "- Social dynamics:\n"
            "  • Authority NPCs: một số bày tỏ surprise khi player vượt expectation — dramatic irony\n"
            "  • Enemy NPCs: underestimate tạo openings — player exploit hoặc subvert\n"
            "  • Companion nam: respect earned qua action, không given tự động\n"
            "  • ⚠️ KHÔNG viết female player như victim/damsel — luôn là protagonist active\n"
            "  • Dignity bất kể NPC bias — bias của NPC là drama, không phải norma"
        )
        if is_romance:
            lines.append(
                "- Romance layer (tag: romance):\n"
                "  • NPC nam tương thích: bị intimidated hoặc fascinated bởi player mạnh\n"
                "  • Power subversion: player nữ mạnh hơn NPC nam tạo interesting dynamic\n"
                "  • NPC nữ tương thích: shared understanding, silence có nghĩa hơn lời nói"
            )

    # ── Tone modifiers ──
    if is_dark:
        lines.append(
            "- Tone Dark modifier:\n"
            "  • NPCs terse hơn, formal hơn bất kể gender\n"
            "  • Ít warmth trong address forms — khoảng cách cảm xúc rõ hơn\n"
            "  • Subtext nặng hơn lời nói trực tiếp"
        )
    elif is_comedy:
        lines.append(
            "- Tone Comedy modifier:\n"
            "  • NPCs có thể casual hơn expected, dùng nickname nếu phù hợp character\n"
            "  • Address forms playful, có thể đảo ngược hierarchy một cách hài hước\n"
            "  • Tránh stereotype nhưng có thể exaggerate social expectations để satirize"
        )

    return "\n".join(lines)

