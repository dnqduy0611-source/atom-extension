"""World State — world-level dynamic state tracked per story (Phase 1: per-player).

Tracks:
- Emissary status (active / revealed / eliminated / converted)
- General status (shadow / manifested / confronted / defeated)
- Tower progress (highest floor, cleared floors, instability)
- World flags (boolean events: corruption spread, Council aware, etc.)
- Narrative events (accumulated world_state_updates strings from simulator)

Threat pressure is computed from tower instability, enforcement intensity,
and Lieutenant/Anomaly activity → 5 tones: calm/observed/contested/siege/anomalous.

Villain resonance system tracks empire_resonance (0-100) and identity_anchor (0-100)
for the dual-axis villain philosophy system (VILLAIN_SYSTEM_SPEC).

Phase 3: per-player. Phase 4: shared PostgreSQL (see WORLD_CONSISTENCY_IMPL_SPEC).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# ──────────────────────────────────────────────
# Sub-models
# ──────────────────────────────────────────────


class EmissaryStatus(BaseModel):
    """Tracks a single Emissary's narrative state as visible to this player.

    Extended for Villain System: sympathy_score tracks hidden player
    alignment with Emissary philosophy, allegiance_offered tracks whether
    the Empire invitation has been presented.
    """

    status: Literal["active", "revealed", "eliminated", "converted"] = "active"
    revealed_to_player: bool = False
    chapter_revealed: int | None = None
    chapter_resolved: int | None = None
    notes: str = ""  # freeform note for AI guidance

    # Villain System extensions (VILLAIN_SYSTEM_SPEC §3)
    sympathy_score: int = 0          # 0-100, hidden from player
    allegiance_offered: bool = False  # True after Empire invitation presented

    # Villain Power System (COMPANION_VILLAIN_GENDER_SPEC §2.6)
    revealed_abilities: list[str] = Field(default_factory=list)  # ability names player has witnessed
    encounter_count: int = 0          # total encounters with this emissary


class GeneralStatus(BaseModel):
    """Tracks a General's Phase 1 state.

    Extended for Villain System: encounter tracking fields for the
    multi-phase General encounter structure.
    """

    status: Literal["shadow", "manifested", "confronted", "defeated"] = "shadow"
    chapter_manifested: int | None = None
    nce_triggered: bool = False  # Null Choice Event
    notes: str = ""

    # Villain System extensions (VILLAIN_SYSTEM_SPEC §4)
    encounter_phase: int = 0         # 0=not started, 1=confrontation, 2=demonstration, 3=resolution
    resolution: str = ""             # victory | alliance | stalemate | "" (pending)
    philosophy_absorbed: bool = False
    last_words: str = ""             # General's final philosophical statement

    # Villain Power System (COMPANION_VILLAIN_GENDER_SPEC §2.6)
    revealed_abilities: list[str] = Field(default_factory=list)  # ability names player has witnessed
    encounter_count: int = 0          # total encounters with this general


class TowerState(BaseModel):
    """Tracks player's Tower journey state."""

    highest_floor_reached: int = 0
    floors_cleared: list[int] = Field(default_factory=list)
    active_anomalies: list[str] = Field(default_factory=list)
    instability_score: int = 0  # 0-100; escalates per anomaly event


class GeneralEncounter(BaseModel):
    """Record of a single General encounter phase (VILLAIN_SYSTEM_SPEC §4)."""

    general_id: str
    phase_reached: int = 1              # 1=confrontation, 2=demonstration, 3=resolution
    resolution: str = "pending"         # victory | alliance | stalemate | pending
    philosophy_absorbed: bool = False
    last_words: str = ""                # General's final statement
    empire_resonance_delta: int = 0
    identity_anchor_delta: int = 0
    mutation_triggered: str = ""        # mirror_crack | conversion | resistant
    chapter: int = 0


class EmissaryInteraction(BaseModel):
    """Record of a single Emissary interaction (VILLAIN_SYSTEM_SPEC §3)."""

    emissary_id: str
    chapter: int = 0
    sympathy_delta: int = 0
    empire_resonance_delta: int = 0
    identity_anchor_delta: int = 0
    interaction_type: str = "neutral_response"  # agreed_with_logic | showed_understanding | neutral_response | mild_disagreement | strong_rejection


# ──────────────────────────────────────────────
# WorldState
# ──────────────────────────────────────────────

# Canonical villain IDs (from entity_registry.yaml)
_DEFAULT_EMISSARIES = ("kaen", "sira", "thol")
_DEFAULT_GENERALS = ("vorn", "kha", "mireth", "azen")


class WorldState(BaseModel):
    """World-level state for a single player's story.

    Phase 1 behavior:
    - Persisted per story_id to SQLite
    - Loaded in context node, injected into writer/critic
    - Updated in ledger node after each chapter

    Fields:
        emissary_status: Per-Emissary tracking dict
        general_status:  Per-General tracking dict
        tower:           Tower floor + instability data
        world_flags:     Boolean event flags (see below)
        narrative_events: Accumulated free-text world_state_updates from simulator
        empire tracking: Active tier, enforcement intensity, etc.
    """

    season: int = 1

    # ── Villain status ──
    emissary_status: dict[str, EmissaryStatus] = Field(
        default_factory=lambda: {k: EmissaryStatus() for k in _DEFAULT_EMISSARIES}
    )
    general_status: dict[str, GeneralStatus] = Field(
        default_factory=lambda: {k: GeneralStatus() for k in _DEFAULT_GENERALS}
    )

    # ── Tower ──
    tower: TowerState = Field(default_factory=TowerState)

    # ── Boolean world events ──
    world_flags: dict[str, bool] = Field(default_factory=dict)
    # Meaningful flag keys:
    #   "great_awakening_public"        — public knowledge of mass reincarnations
    #   "minor_gate2_corruption_spread" — Cổng Máu corruption widened noticeably
    #   "council_pillars_aware"         — Council of Pillars knows this player exists
    #   "veiled_will_signal_detected"   — first anomaly event logged

    # ── Empire force tracking (from FORCE_TAXONOMY_SPEC) ──
    active_empire_tiers: list[int] = Field(default_factory=list)
    general_zone_affiliation: str = ""    # "vorn"|"kha"|"mireth"|"azen" — assigned General
    watcher_active: bool = False
    enforcement_intensity: int = 0        # 0-100
    lieutenant_unit_deployed: bool = False
    had_empire_encounter: bool = False    # Reset each chapter — used for decay

    # ── Villain Resonance System (VILLAIN_SYSTEM_SPEC §5) ──
    empire_resonance: int = 0             # 0-100, alignment with Empire philosophy
    identity_anchor: int = 0              # 0-100, steadfastness to original Identity
    empire_allegiance: str = "none"       # none | sympathizer | agent | defector
    empire_route_unlocked: bool = False
    active_general: str = ""              # General currently "hunting" player
    unresolved_tensions: list[str] = Field(default_factory=list)  # General IDs with stalemate
    veiled_will_phase: int = 0            # 0=hidden, 1=calamity, 2=pattern, 3=revelation
    absorbed_arguments: list[str] = Field(default_factory=list)   # Philosophy arguments accepted
    rejected_arguments: list[str] = Field(default_factory=list)   # Philosophy arguments rejected
    general_encounters: list[GeneralEncounter] = Field(default_factory=list)
    emissary_interactions: list[EmissaryInteraction] = Field(default_factory=list)

    # ── Tower threat ──
    tower_instability: int = 0            # 0-100 (mirrors tower.instability_score)
    identity_echo_present: bool = False
    world_anomaly_active: bool = False

    # ── Accumulated narrative events ──
    narrative_events: list[str] = Field(default_factory=list)
    # Appended from simulator_output.world_state_updates each chapter
    # Capped at 20 most recent to control prompt size

    # ──────────────────────────────────────────
    # Threat pressure
    # ──────────────────────────────────────────

    def get_threat_pressure(self) -> str:
        """Compute narrative threat tone for this chapter.

        Returns:
            One of: "calm" / "observed" / "contested" / "siege" / "anomalous"
        """
        if self.world_anomaly_active:
            return "anomalous"
        if self.lieutenant_unit_deployed or self.enforcement_intensity >= 70:
            return "siege"
        if self.enforcement_intensity >= 40 or self.tower_instability >= 60:
            return "contested"
        if self.watcher_active or self.tower_instability >= 30:
            return "observed"
        return "calm"

    # ──────────────────────────────────────────
    # Prompt injection
    # ──────────────────────────────────────────

    def has_notable_state(self) -> bool:
        """Return True if world state has anything worth injecting into context.

        Used by context.py to skip injection for brand-new stories with no data.
        """
        return bool(
            any(s.revealed_to_player for s in self.emissary_status.values())
            or any(s.status != "shadow" for s in self.general_status.values())
            or self.tower.highest_floor_reached > 0
            or self.tower.active_anomalies
            or any(self.world_flags.values())
            or self.narrative_events
            or self.get_threat_pressure() != "calm"
        )

    def to_prompt_string(self) -> str:
        """Format world state as compact prompt injection block.

        Returns empty string if nothing notable to inject (has_notable_state() == False).
        Only includes non-default / notable state so the block stays small.
        """
        if not self.has_notable_state():
            return ""

        parts: list[str] = ["## WORLD STATE:"]

        # Emissaries revealed to player
        revealed = [
            f"{name} ({s.status})"
            for name, s in self.emissary_status.items()
            if s.revealed_to_player
        ]
        if revealed:
            parts.append(f"- Emissary đã lộ diện: {', '.join(revealed)}")

        # Generals manifested
        manifested = [
            name for name, s in self.general_status.items()
            if s.status != "shadow"
        ]
        if manifested:
            parts.append(f"- General đã xuất hiện vật lý: {', '.join(manifested)}")

        # Tower
        if self.tower.highest_floor_reached > 0:
            parts.append(f"- Tower: tầng cao nhất đạt được = {self.tower.highest_floor_reached}")
        if self.tower.active_anomalies:
            parts.append(f"- Tower anomaly đang active: {', '.join(self.tower.active_anomalies)}")

        # ── Force Taxonomy: Threat Environment ──
        pressure = self.get_threat_pressure()
        if pressure != "calm":
            parts.append(f"- Threat pressure: {pressure}")

        # Empire presence detail
        if self.watcher_active:
            parts.append("- Empire: Watcher đã kích hoạt — player đang bị theo dõi")
        if self.enforcement_intensity > 0:
            if self.enforcement_intensity >= 70:
                parts.append(f"- Empire: Enforcement cường độ CAO ({self.enforcement_intensity}/100) — encounter bất kỳ lúc nào")
            elif self.enforcement_intensity >= 40:
                parts.append(f"- Empire: Enforcement đang tăng ({self.enforcement_intensity}/100) — tuần tra thường xuyên")
            else:
                parts.append(f"- Empire: Enforcement nhẹ ({self.enforcement_intensity}/100)")

        # General-specific enforcement style
        _GENERAL_TONE = {
            "vorn": "Enforcement kiểu Vorn: không nói, chỉ tiến — warrior-grade, direct assault",
            "kha": "Enforcement kiểu Kha: hit-and-fade, không ai nhớ khuôn mặt — adaptable units",
            "mireth": "Enforcement kiểu Mireth: augmented soldiers, không còn hoàn toàn là người",
            "azen": "Enforcement kiểu Azen: diplomatic enforcers, lời mời nghe như mệnh lệnh",
        }
        if self.general_zone_affiliation and self.enforcement_intensity > 0:
            tone = _GENERAL_TONE.get(self.general_zone_affiliation, "")
            if tone:
                parts.append(f"- {tone}")

        if self.lieutenant_unit_deployed:
            parts.append("- Lieutenant Unit đã triển khai — pre-boss escalation")

        # Tower instability
        if self.tower_instability >= 30:
            if self.tower_instability >= 60:
                parts.append(f"- Tower: BẤT ỔN CAO ({self.tower_instability}/100) — layout thay đổi, dead-ends xuất hiện")
            else:
                parts.append(f"- Tower: bất ổn ({self.tower_instability}/100) — cảm giác lạ")

        # Outer Corruption
        if self.identity_echo_present:
            parts.append("- Outer: Identity Echo hiện diện — bóng hình giống player, dialogue fragments")
        if self.world_anomaly_active:
            parts.append("- Outer: World Anomaly — hiện tượng không nguyên nhân, reality unreliable")

        # Active world flags
        active_flags = [k for k, v in self.world_flags.items() if v]
        if active_flags:
            readable = ", ".join(active_flags)
            parts.append(f"- World events đã xảy ra: {readable}")

        # Recent narrative events (last 5 only in prompt)
        if self.narrative_events:
            recent = self.narrative_events[-5:]
            parts.append("- Sự kiện thế giới gần đây:")
            for event in recent:
                parts.append(f"  · {event}")

        return "\n".join(parts)

    # ──────────────────────────────────────────
    # Update helpers
    # ──────────────────────────────────────────

    def absorb_simulator_updates(self, updates: list[str]) -> None:
        """Append simulator world_state_updates to narrative_events.

        Applies heuristic detection for key patterns:
        - Tower instability keyword → increment tower_instability
        - Corruption spread keyword → set minor_gate2_corruption_spread flag
        - Council aware keyword → set council_pillars_aware flag
        - Anomaly keyword → set world_anomaly_active temporarily

        All updates are also appended to narrative_events (capped at 20).
        """
        if not updates:
            return

        for update in updates:
            lower = update.lower()

            # Tower instability — only specific instability keywords, not generic floor mentions
            if any(kw in lower for kw in ("tower instability", "tháp bất ổn", "tháp mất ổn định")):
                self.tower_instability = min(100, self.tower_instability + 5)
                self.tower.instability_score = self.tower_instability

            # Corruption spread
            if any(kw in lower for kw in ("corruption spread", "tham nhũng lan", "bóng tối lan", "cổng máu")):
                self.world_flags["minor_gate2_corruption_spread"] = True

            # Council awareness
            if any(kw in lower for kw in ("council aware", "hội đồng biết", "council of pillars")):
                self.world_flags["council_pillars_aware"] = True

            # World anomaly
            if any(kw in lower for kw in ("anomaly", "dị thường", "reality fracture", "thực tại rạn")):
                self.world_anomaly_active = True
                self.world_flags["veiled_will_signal_detected"] = True

            # Empire enforcement escalation
            if any(kw in lower for kw in ("enforcement patrol", "watcher deployed", "giám sát viên")):
                self.watcher_active = True
                self.enforcement_intensity = min(100, self.enforcement_intensity + 10)

        # Append all, cap at 20
        self.narrative_events.extend(updates)
        if len(self.narrative_events) > 20:
            self.narrative_events = self.narrative_events[-20:]

    def update_tower(self, floor: int) -> None:
        """Record player reaching a new Tower floor."""
        if floor > self.tower.highest_floor_reached:
            self.tower.highest_floor_reached = floor
        if floor not in self.tower.floors_cleared:
            self.tower.floors_cleared.append(floor)

    def reveal_emissary(self, emissary_id: str, chapter: int) -> None:
        """Mark an Emissary as revealed to the player."""
        if emissary_id in self.emissary_status:
            s = self.emissary_status[emissary_id]
            s.revealed_to_player = True
            s.status = "revealed"
            s.chapter_revealed = chapter
        else:
            self.emissary_status[emissary_id] = EmissaryStatus(
                status="revealed",
                revealed_to_player=True,
                chapter_revealed=chapter,
            )

    def set_flag(self, flag: str, value: bool = True) -> None:
        """Set a world flag."""
        self.world_flags[flag] = value

    # ──────────────────────────────────────────
    # Force Taxonomy — Auto-trigger + Decay
    # Spec: FORCE_TAXONOMY_SPEC §IV, §V, §VI
    # ──────────────────────────────────────────

    def update_threat_triggers(
        self,
        notoriety: float = 0.0,
        identity_coherence: float = 100.0,
        act: int = 1,
    ) -> None:
        """Deterministic auto-trigger for Empire Force tiers and Outer Corruption.

        Call after identity update each chapter. Uses player notoriety,
        coherence, Tower floor, and act number to activate/deactivate
        threat tiers.

        Args:
            notoriety: Player notoriety (0-100)
            identity_coherence: Player identity coherence (0-100)
            act: Current story act (1-4), derived from chapter_number
        """
        # ── Tier 1: Watcher ──
        # Trigger: notoriety >= 25, or Floor 1 cleared, or Emissary contact
        if not self.watcher_active:
            emissary_contact = any(
                s.revealed_to_player for s in self.emissary_status.values()
            )
            if (
                notoriety >= 25
                or 1 in self.tower.floors_cleared
                or emissary_contact
            ):
                self.watcher_active = True
                if 1 not in self.active_empire_tiers:
                    self.active_empire_tiers.append(1)

        # ── Tier 2: Enforcement ──
        # Trigger: notoriety >= 50
        if notoriety >= 50:
            if 2 not in self.active_empire_tiers:
                self.active_empire_tiers.append(2)

        # ── Tier 3: Lieutenant Unit ──
        # Trigger: (enforcement_intensity >= 70 AND act >= 3) OR Floor 2 cleared
        floor2_cleared = 2 in self.tower.floors_cleared
        if (
            (self.enforcement_intensity >= 70 and act >= 3)
            or floor2_cleared
        ):
            if not self.lieutenant_unit_deployed:
                self.lieutenant_unit_deployed = True
                if 3 not in self.active_empire_tiers:
                    self.active_empire_tiers.append(3)

        # ── Outer: Tower instability ──
        self.compute_tower_instability(identity_coherence)

        # ── Outer: Identity Echo ──
        # Trigger: Floor 2+ or tower_instability >= 30
        if self.tower.highest_floor_reached >= 2 or self.tower_instability >= 30:
            self.identity_echo_present = True

        # ── Outer: World Anomaly ──
        # Trigger: Act 3-4 + veiled_will signal, or very high coherence
        if act >= 3:
            veiled_will = any(
                s.nce_triggered for s in self.general_status.values()
            ) or self.world_flags.get("veiled_will_signal_detected", False)
            if veiled_will or identity_coherence >= 80:
                self.world_anomaly_active = True

    def apply_chapter_decay(self) -> None:
        """Apply per-chapter decay to enforcement intensity.

        If no Empire encounter happened this chapter, enforcement_intensity
        decreases by 5 (patrols reduce where player is absent).
        Resets the encounter flag for next chapter.

        Spec: FORCE_TAXONOMY_SPEC §IV Tier 2 — decay rule.
        """
        if not self.had_empire_encounter:
            self.enforcement_intensity = max(0, self.enforcement_intensity - 5)
        # Reset for next chapter
        self.had_empire_encounter = False

    def compute_tower_instability(self, identity_coherence: float = 100.0) -> None:
        """Compute tower instability from player coherence + floor.

        Formula: tower_instability = max(0, 100 - coherence + floor_modifier)
        floor_modifier: Floor 1 = +0, Floor 2 = +15, Floor 3 = +30

        Spec: FORCE_TAXONOMY_SPEC §V.1
        """
        floor = self.tower.highest_floor_reached
        floor_modifier = {0: 0, 1: 0, 2: 15, 3: 30}.get(floor, 30)
        self.tower_instability = max(0, int(100 - identity_coherence + floor_modifier))
        self.tower.instability_score = self.tower_instability
