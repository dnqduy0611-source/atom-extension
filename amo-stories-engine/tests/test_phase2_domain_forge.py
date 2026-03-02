"""Phase 2 tests — Forge Prompt V2, Domain System, Principle Resonance.

Tests domain rules, axis blind spots, domain combat bonus,
V2 forge prompt structure, V2 response parsing, and resonance calculation.
"""

import pytest

from app.engine.domain import (
    DOMAIN_RULES,
    AXIS_BLIND_SPOTS,
    DOMAIN_SCALING,
    apply_domain_bonus,
    get_axis_blind_spot,
    get_domain_rule,
    get_domain_scaling,
)
from app.engine.soul_forge import (
    _build_forge_prompt_v2,
    _parse_v2_skill_fields,
    calculate_principle_resonance,
)
from app.models.player import SubSkill, UniqueSkill
from app.models.soul_forge import BehavioralFingerprint, IdentitySignals
from app.models.unique_skill_growth import PrincipleResonance


# ──────────────────────────────────────────────
# Domain Rules
# ──────────────────────────────────────────────

class TestDomainRules:
    """Domain system rule tests."""

    def test_all_categories_have_rules(self):
        categories = {"perception", "manifestation", "manipulation", "contract", "obfuscation"}
        assert set(DOMAIN_RULES.keys()) == categories

    def test_each_rule_has_required_fields(self):
        for cat, rule in DOMAIN_RULES.items():
            assert "immunity" in rule, f"{cat} missing immunity"
            assert "authority_bonus" in rule, f"{cat} missing authority_bonus"
            assert "narrative" in rule, f"{cat} missing narrative"

    def test_authority_bonus_is_3_percent(self):
        for cat, rule in DOMAIN_RULES.items():
            assert rule["authority_bonus"] == 0.03, f"{cat} bonus != 0.03"

    def test_get_domain_rule(self):
        rule = get_domain_rule("perception")
        assert rule is not None
        assert rule["authority_bonus"] == 0.03

    def test_get_domain_rule_invalid(self):
        assert get_domain_rule("nonexistent") is None


class TestAxisBlindSpots:
    """Structural blind spot tests."""

    def test_all_categories_have_blind_spots(self):
        categories = {"perception", "manifestation", "manipulation", "contract", "obfuscation"}
        assert set(AXIS_BLIND_SPOTS.keys()) == categories

    def test_get_axis_blind_spot(self):
        assert get_axis_blind_spot("manifestation") == "Chỉ tác động trực tiếp — không buff/shield từ xa cho đồng đội"

    def test_unknown_category_returns_empty(self):
        assert get_axis_blind_spot("unknown") == ""


class TestDomainScaling:
    """Domain scaling per growth stage tests."""

    def test_all_stages_defined(self):
        assert set(DOMAIN_SCALING.keys()) == {"seed", "bloom", "aspect", "ultimate"}

    def test_seed_no_narrative(self):
        scaling = get_domain_scaling("seed")
        assert scaling["narrative_effect"] is False

    def test_aspect_has_narrative(self):
        scaling = get_domain_scaling("aspect")
        assert scaling["narrative_effect"] is True

    def test_ultimate_breaks_tier_cap(self):
        scaling = get_domain_scaling("ultimate")
        assert scaling["immunity_tier_cap"] > 10


# ──────────────────────────────────────────────
# Domain Combat Bonus
# ──────────────────────────────────────────────

class TestApplyDomainBonus:
    """Domain combat bonus calculation tests."""

    def test_bonus_when_matchup(self):
        enemy_skills = [{"category": "perception", "tier": 2}]
        bonus = apply_domain_bonus("perception", enemy_skills)
        assert bonus == 0.03

    def test_no_bonus_different_category(self):
        enemy_skills = [{"category": "manifestation", "tier": 2}]
        bonus = apply_domain_bonus("perception", enemy_skills)
        assert bonus == 0.0

    def test_no_bonus_empty_enemies(self):
        bonus = apply_domain_bonus("perception", [])
        assert bonus == 0.0

    def test_bonus_seed_only_tier_3(self):
        """Seed stage only immune vs Tier 1-3."""
        enemy_tier4 = [{"category": "perception", "tier": 4}]
        bonus = apply_domain_bonus("perception", enemy_tier4, player_stage="seed")
        assert bonus == 0.0

    def test_bonus_ultimate_any_tier(self):
        """Ultimate stage immune vs any tier."""
        enemy_tier4 = [{"category": "perception", "tier": 4}]
        bonus = apply_domain_bonus("perception", enemy_tier4, player_stage="ultimate")
        assert bonus == 0.03

    def test_invalid_category_no_bonus(self):
        enemy_skills = [{"category": "perception", "tier": 2}]
        bonus = apply_domain_bonus("invalid", enemy_skills)
        assert bonus == 0.0


# ──────────────────────────────────────────────
# V2 Forge Prompt
# ──────────────────────────────────────────────

class TestForgePromptV2:
    """V2 forge prompt structure tests."""

    @pytest.fixture
    def signals(self):
        return IdentitySignals(
            void_anchor="power",
            attachment_style="power-seeking",
            moral_core="aggression",
            decision_pattern="instinctive",
            risk_tolerance=3,
            soul_fragment_raw="Tôi sẽ không bao giờ thua",
            soul_fragment_themes=["power", "determination"],
            soul_fragment_emotion="fierce",
            soul_fragment_target="self",
        )

    def test_prompt_contains_v2_sections(self, signals):
        prompt = _build_forge_prompt_v2(signals)
        # V2-specific content
        assert "Domain Passive" in prompt
        assert "weakness_type" in prompt
        assert "unique_clause" in prompt
        assert "domain_passive" in prompt

    def test_prompt_contains_7_weakness_types(self, signals):
        prompt = _build_forge_prompt_v2(signals)
        for wt in ["soul_echo", "principle_bleed", "resonance_dependency",
                    "target_paradox", "sensory_tax", "environment_lock",
                    "escalation_curse"]:
            assert wt in prompt, f"Missing weakness type: {wt}"

    def test_prompt_contains_player_data(self, signals):
        prompt = _build_forge_prompt_v2(signals)
        assert "power" in prompt  # void_anchor
        assert "aggression" in prompt  # moral_core

    def test_prompt_includes_backstory_when_present(self):
        signals = IdentitySignals(
            backstory="Tôi là một bác sĩ phẫu thuật",
        )
        prompt = _build_forge_prompt_v2(signals)
        assert "bác sĩ phẫu thuật" in prompt

    def test_prompt_excludes_backstory_when_empty(self):
        signals = IdentitySignals(backstory="")
        prompt = _build_forge_prompt_v2(signals)
        assert "Tiểu sử trước Isekai" not in prompt


# ──────────────────────────────────────────────
# V2 Skill Field Parsing
# ──────────────────────────────────────────────

class TestParseV2Fields:
    """V2 response parsing tests."""

    def test_parse_with_domain_passive(self):
        result = {
            "domain_passive": {
                "name": "Thân Thép",
                "mechanic": "Immune Normal defensive +5% resist",
            },
            "weakness_type": "sensory_tax",
            "unique_clause": "Stability < 30% → mạnh hơn",
        }
        fields = _parse_v2_skill_fields(result, "manifestation")
        assert len(fields["sub_skills"]) == 1
        assert fields["sub_skills"][0].name == "Thân Thép"
        assert fields["sub_skills"][0].type == "passive"
        assert fields["sub_skills"][0].unlocked_at == "seed"
        assert fields["domain_passive_name"] == "Thân Thép"
        assert fields["domain_category"] == "manifestation"
        assert fields["weakness_type"] == "sensory_tax"
        assert fields["unique_clause"] == "Stability < 30% → mạnh hơn"
        assert fields["axis_blind_spot"] == "Chỉ tác động trực tiếp — không buff/shield từ xa cho đồng đội"
        assert fields["current_stage"] == "seed"

    def test_parse_without_domain_passive(self):
        result = {"weakness_type": "soul_echo"}
        fields = _parse_v2_skill_fields(result, "perception")
        assert fields["sub_skills"] == []
        assert fields["domain_passive_name"] == ""
        assert fields["weakness_type"] == "soul_echo"

    def test_invalid_weakness_type_ignored(self):
        result = {"weakness_type": "invalid_type"}
        fields = _parse_v2_skill_fields(result, "perception")
        assert fields["weakness_type"] == ""

    def test_all_7_weakness_types_accepted(self):
        valid_types = [
            "soul_echo", "principle_bleed", "resonance_dependency",
            "target_paradox", "sensory_tax", "environment_lock",
            "escalation_curse",
        ]
        for wt in valid_types:
            fields = _parse_v2_skill_fields({"weakness_type": wt}, "perception")
            assert fields["weakness_type"] == wt, f"Rejected valid type: {wt}"


# ──────────────────────────────────────────────
# Principle Resonance
# ──────────────────────────────────────────────

class TestPrincipleResonanceCalc:
    """Principle Resonance calculation tests."""

    def _make_signals(self, **overrides):
        defaults = {
            "void_anchor": "knowledge",
            "moral_core": "determination",
            "behavioral": BehavioralFingerprint(
                consistency=0.9,
                deliberation=0.8,
                patience=0.7,
                confidence=0.6,
            ),
        }
        defaults.update(overrides)
        return IdentitySignals(**defaults)

    def test_all_6_principles_present(self):
        signals = self._make_signals()
        skill = UniqueSkill(name="Test", trait_tags=["mind", "relic"])
        res = calculate_principle_resonance(signals, skill)
        for p in ["order", "entropy", "matter", "flux", "energy", "void"]:
            assert hasattr(res, p)

    def test_scores_in_range(self):
        signals = self._make_signals()
        skill = UniqueSkill(name="Test", trait_tags=["mind"])
        res = calculate_principle_resonance(signals, skill)
        for p in ["order", "entropy", "matter", "flux", "energy", "void"]:
            score = getattr(res, p)
            assert 0.0 <= score <= 1.0, f"{p} out of range: {score}"

    def test_void_capped_at_03(self):
        """Void always ≤ 0.3 in Season 1-2."""
        signals = self._make_signals(
            void_anchor="silence",
            behavioral=BehavioralFingerprint(
                patience=1.0, deliberation=1.0, consistency=1.0,
            ),
        )
        skill = UniqueSkill(name="Test", trait_tags=["shadow"])
        res = calculate_principle_resonance(signals, skill)
        assert res.void <= 0.3

    def test_knowledge_anchor_boosts_order(self):
        """void_anchor=knowledge → +10% order."""
        signals_knowledge = self._make_signals(void_anchor="knowledge")
        signals_power = self._make_signals(void_anchor="power")
        skill = UniqueSkill(name="Test", trait_tags=[])

        res_k = calculate_principle_resonance(signals_knowledge, skill)
        res_p = calculate_principle_resonance(signals_power, skill)
        assert res_k.order > res_p.order

    def test_dna_tags_affect_scores(self):
        """DNA tags aligned with a principle should boost that score."""
        signals = self._make_signals()
        skill_with_tags = UniqueSkill(name="Test", trait_tags=["mind", "relic"])
        skill_no_tags = UniqueSkill(name="Test", trait_tags=[])

        res_tags = calculate_principle_resonance(signals, skill_with_tags)
        res_none = calculate_principle_resonance(signals, skill_no_tags)
        assert res_tags.order > res_none.order

    def test_dominant_principle_set(self):
        signals = self._make_signals()
        skill = UniqueSkill(name="Test", trait_tags=["mind", "relic"])
        res = calculate_principle_resonance(signals, skill)
        assert res.dominant_principle != ""
        # Dominant should be the principle with highest score
        scores = {
            "order": res.order, "entropy": res.entropy, "matter": res.matter,
            "flux": res.flux, "energy": res.energy, "void": res.void,
        }
        assert res.dominant_principle == max(scores, key=scores.get)

    def test_proto_sovereign_threshold(self):
        """Proto-Sovereign when max score >= 0.8."""
        # Engineer signals + tags to push order very high
        signals = self._make_signals(
            void_anchor="knowledge",  # +10% order
            behavioral=BehavioralFingerprint(
                consistency=1.0,    # max
                deliberation=1.0,   # max
                patience=1.0,       # max
                confidence=1.0,     # max
            ),
        )
        skill = UniqueSkill(name="Test", trait_tags=["mind", "relic"])  # Both order tags
        res = calculate_principle_resonance(signals, skill)
        # With maxed behavioral (60%) + both order tags (30%) + knowledge anchor (10%)
        # order should be very high
        assert res.order >= 0.8
        assert res.is_proto_sovereign is True
        assert res.dominant_principle == "order"

    def test_not_proto_sovereign_average(self):
        """Average signals should NOT trigger Proto-Sovereign."""
        signals = self._make_signals(
            behavioral=BehavioralFingerprint(),  # All 0.5
        )
        skill = UniqueSkill(name="Test", trait_tags=["charm"])  # Non-order tag
        res = calculate_principle_resonance(signals, skill)
        assert res.is_proto_sovereign is False
