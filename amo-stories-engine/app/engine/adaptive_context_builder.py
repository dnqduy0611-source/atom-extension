"""Amoisekai — Adaptive Context Builder.

Assembles the unified AdaptiveContext from PlayerState,
then formats it into prompt injection strings for
Writer, Planner, and Context Weight Agent.

Cross-reference:
  - PHASE1_ADAPTIVE_ENGINE §Integration với Context Weight Agent
"""

from __future__ import annotations

from app.models.adaptive import AdaptiveContext
from app.models.adaptive_constants import (
    ARCHETYPE_TIER_TO_EMPIRE_THREAT,
    VILLAIN_ASSIGNMENT,
)
from app.models.player import PlayerState
from app.engine.play_style_engine import format_play_style_prompt


# ──────────────────────────────────────────────
# Build Context from PlayerState
# ──────────────────────────────────────────────

def build_adaptive_context(
    player: PlayerState,
    current_act: int = 1,
    current_milestone: str = "",
    world_state=None,
) -> AdaptiveContext:
    """Build a complete AdaptiveContext from PlayerState.

    Pulls data from all player subsystems into one unified context.

    Args:
        player: Full PlayerState.
        current_act: Current act number (1-4), from story state.
        current_milestone: Current milestone label, from story state.
        world_state: Optional WorldState for empire_resonance/identity_anchor
                     (these fields are tracked on WorldState, not PlayerState).

    Returns:
        AdaptiveContext ready for prompt injection.
    """
    evo = player.archetype_evolution
    archetype = player.archetype

    # Villain assignment lookup
    villain = VILLAIN_ASSIGNMENT.get(archetype, {})

    # Unique skill growth stage
    skill_stage = "seed"
    bloom_path = ""
    if player.unique_skill_growth:
        skill_stage = player.unique_skill_growth.current_stage
        bloom_path = getattr(player.unique_skill_growth, "bloom_path", "")

    # NCE approaching check
    nce_approaching = player.instability >= 50.0

    # Empire threat tier
    empire_threat = ARCHETYPE_TIER_TO_EMPIRE_THREAT.get(
        evo.current_tier.value, "watcher"
    )

    # Read empire_resonance/identity_anchor from WorldState if available,
    # fall back to PlayerState
    _empire_resonance = player.empire_resonance
    _identity_anchor = player.identity_anchor
    _emissary_sympathy = player.emissary_sympathy
    if world_state is not None:
        _empire_resonance = getattr(world_state, 'empire_resonance', _empire_resonance)
        _identity_anchor = getattr(world_state, 'identity_anchor', _identity_anchor)
        _emissary_sympathy = getattr(world_state, 'emissary_sympathy', _emissary_sympathy)

    return AdaptiveContext(
        # Archetype & Play Style
        archetype=archetype,
        seed_archetype=archetype,
        play_style=player.play_style,

        # Archetype Evolution
        archetype_tier=evo.current_tier.value,
        transmuted_form=evo.transmuted_form,
        transmutation_path=evo.transmutation_path,
        archetype_title=evo.archetype_title,

        # Progression
        current_act=current_act,
        current_milestone=current_milestone,
        current_rank=player.current_rank,
        current_floor=player.current_floor,

        # Identity State
        identity_coherence=player.identity_coherence,
        identity_instability=player.instability,
        identity_anchor=_identity_anchor,
        drift_history=player.latent_identity.trigger_events,
        nce_approaching=nce_approaching,
        nce_completed=getattr(player, 'nce_completed', False),

        # Unique Skill Growth
        unique_skill_stage=skill_stage,
        bloom_path=bloom_path,

        # Villain Assignment
        assigned_emissary=villain.get("emissary", ""),
        assigned_general=villain.get("general", ""),
        assigned_lieutenant=villain.get("lieutenant", ""),
        emissary_sympathy=_emissary_sympathy,
        empire_threat_tier=empire_threat,
        empire_resonance=_empire_resonance,
    )


# ──────────────────────────────────────────────
# Format for Prompt Injection
# ──────────────────────────────────────────────

def format_adaptive_prompt(ctx: AdaptiveContext) -> str:
    """Format AdaptiveContext into a complete prompt injection block.

    This is the primary output for Writer and Planner prompts.
    """
    sections = []

    # ── Archetype State ──
    archetype_label = ctx.archetype_title or ctx.archetype
    tier_names = {1: "Origin", 2: "Transmuted", 3: "Ascendant", 4: "Legendary"}
    tier_name = tier_names.get(ctx.archetype_tier, "Unknown")

    sections.append(
        "## ARCHETYPE STATE\n"
        f"- Origin: {ctx.archetype}\n"
        f"- Current Tier: {ctx.archetype_tier} ({tier_name})\n"
        f"- Transmuted Form: {ctx.transmuted_form or 'Not yet transmuted'}\n"
        f"- Title: {ctx.archetype_title or 'N/A'}\n"
        f"- Transmutation Path: {ctx.transmutation_path or 'N/A'}"
    )

    # ── Play Style ──
    sections.append(
        "## PLAY STYLE\n"
        f"- {format_play_style_prompt(ctx.play_style)}"
    )

    # ── Progression ──
    sections.append(
        "## PROGRESSION\n"
        f"- Act: {ctx.current_act}\n"
        f"- Milestone: {ctx.current_milestone or 'N/A'}\n"
        f"- Rank: {ctx.current_rank}\n"
        f"- Tower Floor: {ctx.current_floor}"
    )

    # ── Identity State ──
    coherence_label = _label_value(ctx.identity_coherence)
    instability_label = _label_value(ctx.identity_instability)

    sections.append(
        "## IDENTITY STATE\n"
        f"- Coherence: {coherence_label} ({ctx.identity_coherence:.0f})\n"
        f"- Instability: {instability_label} ({ctx.identity_instability:.0f})\n"
        f"- NCE Approaching: {'YES' if ctx.nce_approaching else 'no'}\n"
        f"- Identity Anchor: {ctx.identity_anchor or 'N/A'}\n"
        f"- Drift History: {', '.join(ctx.drift_history) if ctx.drift_history else 'None'}"
    )

    # ── Unique Skill ──
    sections.append(
        "## UNIQUE SKILL\n"
        f"- Stage: {ctx.unique_skill_stage}\n"
        f"- Bloom Path: {ctx.bloom_path or 'N/A'}"
    )

    # ── Villain Assignment ──
    sections.append(
        "## VILLAIN ASSIGNMENT\n"
        f"- Emissary: {ctx.assigned_emissary or 'N/A'}\n"
        f"- Emissary Sympathy: {ctx.emissary_sympathy}\n"
        f"- General: {ctx.assigned_general or 'N/A'}\n"
        f"- Lieutenant: {ctx.assigned_lieutenant or 'N/A'}\n"
        f"- Empire Threat: {ctx.empire_threat_tier}\n"
        f"- Empire Resonance: {ctx.empire_resonance}"
    )

    # ── Phase 1 Triggers ──
    try:
        from app.engine.phase1_triggers import (
            check_nce_trigger,
            check_emissary_trigger,
            get_floor_hint,
        )

        floor_hint = get_floor_hint(ctx.current_floor)
        if floor_hint:
            sections.append(f"## TOWER FLOOR\n{floor_hint}")

        nce_directive = check_nce_trigger(ctx)
        if nce_directive:
            sections.append(nce_directive)

        emissary_directive = check_emissary_trigger(ctx)
        if emissary_directive:
            sections.append(emissary_directive)
    except Exception:
        pass  # Graceful degradation: triggers are optional

    return "\n\n".join(sections)


def format_writer_context(ctx: AdaptiveContext) -> str:
    """Narrative texture block for Scene Writer agent.

    Translates player state numbers into PROSE DIRECTION.
    Writer doesn't need numbers — it needs to know HOW TO WRITE.
    Philosophy: metadata → craft instruction.
    """
    parts = []

    # ── Identity Texture ──
    identity_texture = _identity_to_prose_texture(ctx)
    if identity_texture:
        parts.append(f"🎭 NHÂN VẬT NỘI TÂM:\n{identity_texture}")

    # ── Floor Atmosphere (prose-only, no law modifier language) ──
    floor_atm = _floor_to_atmosphere(ctx.current_floor)
    if floor_atm:
        parts.append(f"🌐 MÔI TRƯỜNG TOWER:\n{floor_atm}")

    # ── Emissary Prose Texture (only if sympathy meaningful) ──
    if ctx.assigned_emissary and ctx.emissary_sympathy >= 20:
        emissary_texture = _emissary_to_prose_texture(ctx)
        if emissary_texture:
            parts.append(f"👤 {ctx.assigned_emissary.upper()}:\n{emissary_texture}")

    # ── NCE Tension Warning ──
    if ctx.nce_approaching and not getattr(ctx, "nce_completed", False):
        parts.append(
            "⚠️ TENSION BUILDING: Instability đang tích lũy.\n"
            "Prose thể hiện qua hành vi nhỏ — không nói thẳng:\n"
            "nắm chặt tay không cần thiết, thở chậm hơn bình thường,\n"
            "do dự một nhịp trước hành động quen thuộc."
        )

    # ── Archetype Title (only if transmuted) ──
    if ctx.archetype_title and ctx.archetype_tier >= 2:
        parts.append(
            f"📛 DANH HIỆU: NPC có thể gọi player là '{ctx.archetype_title}' "
            f"khi tôn trọng hoặc thách thức."
        )

    return "\n\n".join(parts) if parts else ""


def _identity_to_prose_texture(ctx: AdaptiveContext) -> str:
    """Convert identity numbers into prose craft direction."""
    coherence = ctx.identity_coherence
    instability = ctx.identity_instability

    if coherence >= 80 and instability < 20:
        return (
            "Player ổn định — cử chỉ chắc chắn, phản xạ tự nhiên.\n"
            "Không cần thể hiện nội tâm rối loạn. Sức mạnh đến từ sự rõ ràng."
        )
    if coherence >= 60 and instability < 40:
        return (
            "Player kiểm soát được — nhưng có chi phí.\n"
            "1-2 chi tiết nhỏ cho thấy kiểm soát là nỗ lực, không phải tự nhiên:\n"
            "nắm chặt hơn cần thiết, ngắt quãng trước quyết định quen thuộc,\n"
            "cơ thể làm đúng nhưng không hoàn toàn thoải mái khi làm."
        )
    if coherence >= 40 and instability < 60:
        return (
            "Player ở điểm cân bằng mỏng manh.\n"
            "Thể hiện sự mâu thuẫn nội tâm qua hành động nhỏ — không phải nổ lớn:\n"
            "một quyết định theo hướng bất ngờ, một câu nói thoát ra theo bản năng\n"
            "trước khi lý trí kịp lọc, rồi player tự bất ngờ với bản thân."
        )
    # coherence < 40 hoặc instability >= 60
    return (
        "Player đang rạn nứt — hai layer của bản thân đang kéo ngược chiều.\n"
        "Thể hiện qua: phản xạ trái với ý định, cơ thể phản ứng trước não,\n"
        "một câu thoát ra không kiểm soát, hoặc player nhận ra mình\n"
        "đã làm điều gì đó trước khi nghĩ tới việc làm nó."
    )


def _floor_to_atmosphere(floor: int) -> str:
    """Translate tower floor to prose atmosphere direction."""
    atmospheres = {
        1: (
            "Thế giới này khác — nhưng còn có logic.\n"
            "Lạ, mới, chưa quen — nhưng phản ứng theo cách có thể dự đoán.\n"
            "Prose: wonder và vulnerability, không phải paranoia."
        ),
        2: (
            "Thế giới bắt đầu PHẢN ỨNG — nhưng luôn ambiguous.\n"
            "Mỗi scene: 1 chi tiết nhỏ không hoàn toàn đúng:\n"
            "bóng đổ góc hơi sai, tiếng footstep không đồng bộ với bề mặt,\n"
            "màu sắc cảnh vật lệch nhẹ theo trạng thái cảm xúc player.\n"
            "Không bao giờ dramatic. Luôn có thể giải thích là mệt mỏi."
        ),
        3: (
            "Thế giới BIẾT player — không phải ẩn dụ, là thực.\n"
            "Cảnh vật phản chiếu identity: bóng di chuyển chậm hơn,\n"
            "mặt nước phản chiếu khuôn mặt không hoàn toàn là player,\n"
            "echo trong hang nghe khác giọng thật.\n"
            "Chỉ 1 detail per scene. Tinh tế. Không giải thích. Không nhấn mạnh."
        ),
        4: (
            "Không gian không tuyến tính — thời gian và không gian không đáng tin.\n"
            "Prose cho phép: bước chân đưa đến nơi chưa đến, nhớ sự kiện chưa xảy ra,\n"
            "skill kích hoạt trước khi player nghĩ đến.\n"
            "Character xử lý điều này bình thường — đây là Floor 4, không phải đặc biệt nữa."
        ),
        5: (
            "Mọi journey hội tụ — echoes từ mọi floor trước.\n"
            "Mỗi bước có thể trigger ký ức, quyết định đã qua, con người player đã là.\n"
            "Prose nặng và chậm — mỗi hành động mang trọng lượng lịch sử."
        ),
    }
    return atmospheres.get(floor, "")


def _emissary_to_prose_texture(ctx: AdaptiveContext) -> str:
    """Translate emissary sympathy level to prose behavior direction."""
    name = ctx.assigned_emissary
    sympathy = ctx.emissary_sympathy

    if sympathy >= 80:
        return (
            f"{name} đang tìm thời điểm để nói điều gì đó thật.\n"
            f"Prose có thể thể hiện: {name} nhìn xung quanh trước khi tiếp tục,\n"
            f"dừng giữa câu rồi đổi chủ đề, hoặc trả lời câu hỏi nhỏ\n"
            f"bằng một câu lớn hơn cần thiết — rồi lập tức thu lại."
        )
    if sympathy >= 50:
        return (
            f"{name} biết nhiều hơn bình thường — crisis approaching.\n"
            f"1 khoảnh khắc per scene nếu {name} xuất hiện:\n"
            f"{name} nhìn player theo cách khác khi player không để ý,\n"
            f"hoặc biết câu trả lời trước khi được hỏi — rồi nhanh chóng cover."
        )
    # sympathy 20-49
    return (
        f"{name} đóng vai NPC bình thường — nhưng có 1 micro-tell per scene:\n"
        f"nhìn đúng hướng player sắp đi trước khi player quyết định,\n"
        f"trả lời câu hỏi player chưa hỏi thành lời,\n"
        f"hoặc biết tên một người player chưa nhắc tên với {name}.\n"
        f"Nhỏ. Có thể bỏ qua. Rồi tiếp tục bình thường."
    )


def format_planner_context(ctx: AdaptiveContext) -> str:
    """Context block for the Planner agent.

    Focuses on milestone, villain, and upcoming events.
    """
    lines = []
    lines.append(f"Act {ctx.current_act}, Milestone: {ctx.current_milestone or 'N/A'}")
    lines.append(f"Rank: {ctx.current_rank}, Archetype Tier: {ctx.archetype_tier}")
    lines.append(f"Villain: Emissary={ctx.assigned_emissary}, General={ctx.assigned_general}")
    lines.append(f"Empire Threat: {ctx.empire_threat_tier}")
    lines.append(f"Skill Stage: {ctx.unique_skill_stage}")

    if ctx.nce_approaching:
        lines.append("⚠️ NCE approaching — see IDENTITY STATE for details")

    return "\n".join(lines)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _label_value(val: float) -> str:
    """Convert a 0-100 value to a descriptive label."""
    if val >= 80:
        return "critical"
    if val >= 60:
        return "high"
    if val >= 40:
        return "moderate"
    if val >= 20:
        return "low"
    return "minimal"
