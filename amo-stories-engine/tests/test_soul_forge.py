"""Tests for Soul Forge models and engine logic."""

import pytest

from app.models.soul_forge import (
    BehavioralFingerprint,
    IdentitySignals,
    SceneChoice,
    SceneData,
    SoulForgeSession,
    SoulForgeStartRequest,
    SoulForgeStartResponse,
    SoulForgeChoiceRequest,
    SoulForgeSceneResponse,
    SoulForgeFragmentRequest,
    SoulForgeForgeRequest,
    SoulForgeForgeResponse,
)
from app.models.player import UniqueSkill
from app.engine.soul_forge import (
    get_scene,
    process_choice,
    process_scene5_advance,
    process_soul_fragment,
    compute_behavioral_fingerprint,
    build_identity_signals,
    derive_archetype,
    derive_dna_tags,
    forge_skill_sync,
    _is_name_too_similar,
    _build_retry_prompt,
    _build_scene5_summary_prompt,
    generate_scene5_summary,
)


# ══════════════════════════════════════════════
# Model Tests
# ══════════════════════════════════════════════


class TestSoulForgeSession:
    def test_defaults(self):
        s = SoulForgeSession(user_id="u1")
        assert s.user_id == "u1"
        assert s.session_id  # auto-generated UUID
        assert s.phase == "narrative"
        assert s.current_scene == 1
        assert s.scene_choices == []
        assert s.soul_fragment_raw == ""

    def test_session_id_unique(self):
        s1 = SoulForgeSession(user_id="u1")
        s2 = SoulForgeSession(user_id="u2")
        assert s1.session_id != s2.session_id


class TestSceneChoice:
    def test_defaults(self):
        c = SceneChoice(scene_id=1, choice_index=0)
        assert c.scene_id == 1
        assert c.choice_index == 0
        assert c.response_time_ms == 0
        assert c.hover_count == 0
        assert c.signal_tags == {}

    def test_with_signals(self):
        c = SceneChoice(
            scene_id=1,
            choice_index=2,
            response_time_ms=3000,
            hover_count=5,
            signal_tags={"void_anchor": "power"},
        )
        assert c.signal_tags["void_anchor"] == "power"
        assert c.response_time_ms == 3000


class TestBehavioralFingerprint:
    def test_defaults(self):
        b = BehavioralFingerprint()
        assert b.decisiveness == 0.5
        assert b.deliberation == 0.5
        assert b.impulsivity == 0.5
        assert b.revision_tendency == 0.5

    def test_custom_values(self):
        b = BehavioralFingerprint(decisiveness=0.9, impulsivity=0.1)
        assert b.decisiveness == 0.9
        assert b.impulsivity == 0.1


class TestIdentitySignals:
    def test_defaults(self):
        s = IdentitySignals()
        assert s.void_anchor == ""
        assert s.moral_core == ""
        assert s.risk_tolerance == 2  # default mid-range
        assert s.soul_fragment_themes == []

    def test_custom(self):
        s = IdentitySignals(
            void_anchor="knowledge",
            moral_core="determination",
            risk_tolerance=3,
            soul_fragment_themes=["truth", "knowledge"],
        )
        assert s.void_anchor == "knowledge"
        assert s.soul_fragment_themes == ["truth", "knowledge"]


class TestUniqueSkillExtended:
    """Test the new Soul Forge fields added to UniqueSkill."""

    def test_new_fields_defaults(self):
        skill = UniqueSkill()
        assert skill.mechanic == ""
        assert skill.limitation == ""
        assert skill.weakness == ""
        assert skill.activation_condition == ""
        assert skill.soul_resonance == ""
        assert skill.evolution_hint == ""
        assert skill.uniqueness_score == 1.0
        assert skill.forge_timestamp is None

    def test_forge_fields(self):
        from datetime import datetime, timezone

        now = datetime.now(timezone.utc)
        skill = UniqueSkill(
            name="Test Skill",
            mechanic="Test mechanic",
            limitation="Once per chapter",
            weakness="Weak to fire",
            soul_resonance="Born from curiosity",
            forge_timestamp=now,
        )
        assert skill.mechanic == "Test mechanic"
        assert skill.forge_timestamp == now


class TestApiModels:
    def test_start_request(self):
        req = SoulForgeStartRequest(user_id="u1")
        assert req.user_id == "u1"

    def test_choice_request(self):
        req = SoulForgeChoiceRequest(
            session_id="s1",
            choice_index=2,
            response_time_ms=3000,
            hover_count=3,
        )
        assert req.choice_index == 2
        assert req.hover_count == 3

    def test_fragment_request(self):
        req = SoulForgeFragmentRequest(
            session_id="s1",
            text="My family",
            typing_time_ms=10000,
            revision_count=2,
        )
        assert req.text == "My family"
        assert req.typing_time_ms == 10000

    def test_forge_request(self):
        req = SoulForgeForgeRequest(session_id="s1", name="Hero")
        assert req.name == "Hero"

    def test_forge_response(self):
        resp = SoulForgeForgeResponse(
            session_id="s1",
            player_id="p1",
            skill_name="Test",
            skill_description="Desc",
            skill_category="perception",
            soul_resonance="Born from knowledge",
            archetype="sage",
            archetype_display="Hien Triet",
            dna_affinity=["mind", "relic"],
        )
        assert resp.skill_name == "Test"
        assert resp.archetype == "sage"
        assert resp.soul_resonance == "Born from knowledge"


# ══════════════════════════════════════════════
# Engine: Scene Routing
# ══════════════════════════════════════════════


class TestGetScene:
    def test_scene_1_returns_4_choices(self):
        s = SoulForgeSession(user_id="u1")
        scene = get_scene(s)
        assert scene.scene_id == 1
        assert scene.phase == "narrative"
        assert scene.title == "The Awakening Void"
        assert len(scene.choices) == 4

    def test_scene_1_choices_have_text(self):
        s = SoulForgeSession(user_id="u1")
        scene = get_scene(s)
        for c in scene.choices:
            assert c["text"]  # choices are dicts
            assert isinstance(c["index"], int)

    def test_scene_2_variant_connection(self):
        """Scene 2 should vary based on Scene 1 choice."""
        s = SoulForgeSession(user_id="u1", current_scene=2)
        s.scene_choices.append(
            SceneChoice(
                scene_id=1, choice_index=0,
                signal_tags={"void_anchor": "connection"},
            )
        )
        scene = get_scene(s)
        assert scene.scene_id == 2
        assert "Bonds" in scene.title
        assert len(scene.choices) == 3

    def test_scene_2_all_variants(self):
        """Each void_anchor produces a different Scene 2."""
        anchors = ["connection", "power", "knowledge", "silence"]
        titles = set()
        for idx, anchor in enumerate(anchors):
            s = SoulForgeSession(user_id="u1", current_scene=2)
            s.scene_choices.append(
                SceneChoice(scene_id=1, choice_index=idx,
                            signal_tags={"void_anchor": anchor})
            )
            scene = get_scene(s)
            titles.add(scene.title)
        assert len(titles) == 4  # All different

    def test_scene_3_fallback(self):
        """Scene 3 should use deterministic fallback."""
        s = SoulForgeSession(user_id="u1", current_scene=3)
        s.scene_choices = [
            SceneChoice(scene_id=1, choice_index=0,
                        signal_tags={"void_anchor": "connection"}),
            SceneChoice(scene_id=2, choice_index=1,
                        signal_tags={"moral_core": "sacrifice"}),
        ]
        scene = get_scene(s)
        assert scene.scene_id == 3
        assert scene.phase == "narrative"
        assert len(scene.choices) == 3

    def test_scene_4_fallback(self):
        s = SoulForgeSession(user_id="u1", current_scene=4)
        s.scene_choices = [
            SceneChoice(scene_id=1, choice_index=0,
                        signal_tags={"void_anchor": "connection"}),
            SceneChoice(scene_id=2, choice_index=0,
                        signal_tags={"moral_core": "loyalty"}),
            SceneChoice(scene_id=3, choice_index=0,
                        signal_tags={}),
        ]
        scene = get_scene(s)
        assert scene.scene_id == 4
        assert len(scene.choices) == 3

    def test_scene_5_no_choices(self):
        s = SoulForgeSession(user_id="u1", current_scene=5)
        s.scene_choices = [
            SceneChoice(scene_id=i, choice_index=0, signal_tags={})
            for i in range(1, 5)
        ]
        scene = get_scene(s)
        assert scene.scene_id == 5
        assert scene.title == "The Forge"
        assert scene.choices == []  # convergent, no choices

    def test_fragment_phase_scene(self):
        s = SoulForgeSession(user_id="u1", phase="fragment", current_scene=6)
        scene = get_scene(s)
        assert scene.phase == "fragment"

    def test_forging_phase_scene(self):
        s = SoulForgeSession(user_id="u1", phase="forging", current_scene=7)
        scene = get_scene(s)
        assert scene.phase == "forging"


# ══════════════════════════════════════════════
# Engine: Choice Processing
# ══════════════════════════════════════════════


class TestProcessChoice:
    def test_records_choice(self):
        s = SoulForgeSession(user_id="u1")
        s = process_choice(s, choice_index=0, response_time_ms=3000, hover_count=2)
        assert len(s.scene_choices) == 1
        assert s.scene_choices[0].scene_id == 1
        assert s.scene_choices[0].choice_index == 0
        assert s.scene_choices[0].response_time_ms == 3000
        assert s.scene_choices[0].hover_count == 2

    def test_advances_scene(self):
        s = SoulForgeSession(user_id="u1")
        s = process_choice(s, 0, 1000, 0)
        assert s.current_scene == 2

    def test_extracts_signals_scene1(self):
        s = SoulForgeSession(user_id="u1")
        s = process_choice(s, 0, 1000, 0)
        signals = s.scene_choices[0].signal_tags
        assert "void_anchor" in signals
        assert signals["void_anchor"] == "connection"

    def test_extracts_signals_scene1_power(self):
        s = SoulForgeSession(user_id="u1")
        s = process_choice(s, 1, 1000, 0)
        signals = s.scene_choices[0].signal_tags
        assert signals["void_anchor"] == "power"

    def test_records_raw_response_times(self):
        s = SoulForgeSession(user_id="u1")
        s = process_choice(s, 0, 3500, 1)
        assert 3500 in s.raw_response_times

    def test_full_4_choices(self):
        """Process 4 choices (scenes 1-4)."""
        s = SoulForgeSession(user_id="u1")
        for _ in range(4):
            s = process_choice(s, 0, 2000, 1)
        assert len(s.scene_choices) == 4
        assert s.current_scene == 5


class TestProcessScene5Advance:
    def test_advances_to_fragment(self):
        s = SoulForgeSession(user_id="u1", current_scene=5, phase="narrative")
        s = process_scene5_advance(s)
        assert s.phase == "fragment"
        # current_scene stays at 5; get_scene() handles routing by phase


# ══════════════════════════════════════════════
# Engine: Soul Fragment
# ══════════════════════════════════════════════


class TestProcessSoulFragment:
    def test_records_fragment(self):
        s = SoulForgeSession(user_id="u1", phase="fragment")
        s = process_soul_fragment(s, "Gia dinh toi", typing_time_ms=8000, revision_count=1)
        assert s.soul_fragment_raw == "Gia dinh toi"
        assert s.fragment_typing_time_ms == 8000
        assert s.fragment_revision_count == 1

    def test_advances_to_forging(self):
        s = SoulForgeSession(user_id="u1", phase="fragment")
        s = process_soul_fragment(s, "Something important")
        assert s.phase == "forging"


# ══════════════════════════════════════════════
# Engine: Behavioral Fingerprint
# ══════════════════════════════════════════════


class TestComputeBehavioralFingerprint:
    def _make_session_with_times(self, times, fragment_time=5000, fragment_len=30, revisions=0):
        s = SoulForgeSession(user_id="u1")
        s.raw_response_times = times
        s.raw_hover_counts = [1] * len(times)
        s.fragment_typing_time_ms = fragment_time
        s.soul_fragment_raw = "x" * fragment_len
        s.fragment_revision_count = revisions
        return s

    def test_returns_fingerprint(self):
        s = self._make_session_with_times([3000, 4000, 2000, 5000])
        fp = compute_behavioral_fingerprint(s)
        assert isinstance(fp, BehavioralFingerprint)

    def test_all_dimensions_in_range(self):
        s = self._make_session_with_times([1000, 2000, 3000, 4000, 5000])
        fp = compute_behavioral_fingerprint(s)
        for field in ["decisiveness", "deliberation", "expressiveness",
                       "confidence", "patience", "consistency",
                       "impulsivity", "revision_tendency"]:
            val = getattr(fp, field)
            assert 0.0 <= val <= 1.0, f"{field} = {val} out of [0, 1]"

    def test_fast_responses_high_decisiveness(self):
        s = self._make_session_with_times([500, 600, 700, 800])
        fp = compute_behavioral_fingerprint(s)
        assert fp.decisiveness > 0.7

    def test_slow_responses_high_patience(self):
        s = self._make_session_with_times([10000, 12000, 9000, 11000])
        fp = compute_behavioral_fingerprint(s)
        assert fp.patience > 0.5

    def test_fast_sub2s_high_impulsivity(self):
        s = self._make_session_with_times([1000, 1500, 800, 1200, 900])
        fp = compute_behavioral_fingerprint(s)
        assert fp.impulsivity > 0.5

    def test_many_revisions_high_revision_tendency(self):
        s = self._make_session_with_times([3000, 3000], revisions=5)
        fp = compute_behavioral_fingerprint(s)
        assert fp.revision_tendency >= 0.9

    def test_long_fragment_high_expressiveness(self):
        s = self._make_session_with_times([3000], fragment_len=200)
        # Engine uses fragment_char_count, not len(soul_fragment_raw)
        s.fragment_char_count = 200
        fp = compute_behavioral_fingerprint(s)
        assert fp.expressiveness > 0.8


# ══════════════════════════════════════════════
# Engine: Signal Aggregation & Archetype
# ══════════════════════════════════════════════


class TestBuildIdentitySignals:
    def _make_full_session(self):
        s = SoulForgeSession(user_id="u1", phase="forging", current_scene=7)
        s.scene_choices = [
            SceneChoice(scene_id=1, choice_index=0, response_time_ms=3000,
                        signal_tags={"void_anchor": "connection",
                                     "attachment_style": "relational"}),
            SceneChoice(scene_id=2, choice_index=1, response_time_ms=5000,
                        signal_tags={"moral_core": "sacrifice",
                                     "decision_pattern": "empathetic"}),
            SceneChoice(scene_id=3, choice_index=0, response_time_ms=4000,
                        signal_tags={"conflict_response": "negotiate",
                                     "risk_tolerance": 2}),
            SceneChoice(scene_id=4, choice_index=2, response_time_ms=7000,
                        signal_tags={"sacrifice_type": "connection",
                                     "courage_vs_cleverness": "defiance"}),
        ]
        s.raw_response_times = [3000, 5000, 4000, 7000]
        s.raw_hover_counts = [2, 3, 1, 4]
        s.soul_fragment_raw = "Gia dinh toi la tat ca"
        s.fragment_typing_time_ms = 12000
        s.fragment_revision_count = 1
        return s

    def test_builds_signals(self):
        s = self._make_full_session()
        signals = build_identity_signals(s)
        assert isinstance(signals, IdentitySignals)
        assert signals.void_anchor == "connection"
        assert signals.moral_core == "sacrifice"

    def test_includes_behavioral(self):
        s = self._make_full_session()
        signals = build_identity_signals(s)
        assert isinstance(signals.behavioral, BehavioralFingerprint)

    def test_fragment_data(self):
        s = self._make_full_session()
        signals = build_identity_signals(s)
        assert signals.soul_fragment_raw == "Gia dinh toi la tat ca"

    def test_with_fragment_analysis(self):
        s = self._make_full_session()
        analysis = {
            "themes": ["family", "love"],
            "emotion": "gentle",
            "target": "others",
        }
        signals = build_identity_signals(s, fragment_analysis=analysis)
        assert signals.soul_fragment_themes == ["family", "love"]
        assert signals.soul_fragment_emotion == "gentle"
        assert signals.soul_fragment_target == "others"


class TestDeriveArchetype:
    def test_known_combination(self):
        signals = IdentitySignals(void_anchor="connection", moral_core="loyalty")
        arch = derive_archetype(signals)
        assert isinstance(arch, str)
        assert arch != ""

    def test_unknown_combination_defaults_to_wanderer(self):
        signals = IdentitySignals(void_anchor="unknown", moral_core="unknown")
        arch = derive_archetype(signals)
        assert arch == "wanderer"

    def test_all_4_anchors_produce_archetype(self):
        """Each void_anchor should map to at least one valid archetype."""
        anchors = ["connection", "power", "knowledge", "silence"]
        for a in anchors:
            signals = IdentitySignals(void_anchor=a, moral_core="loyalty")
            arch = derive_archetype(signals)
            assert isinstance(arch, str)


class TestDeriveDnaTags:
    def test_returns_list(self):
        signals = IdentitySignals(void_anchor="connection", moral_core="loyalty")
        tags = derive_dna_tags(signals)
        assert isinstance(tags, list)

    def test_max_3_tags(self):
        signals = IdentitySignals(
            void_anchor="connection",
            moral_core="loyalty",
            soul_fragment_themes=["protection", "justice", "freedom", "power"],
        )
        tags = derive_dna_tags(signals)
        assert len(tags) <= 3

    def test_connection_produces_oath_or_charm(self):
        signals = IdentitySignals(void_anchor="connection", moral_core="loyalty")
        tags = derive_dna_tags(signals)
        assert any(t in tags for t in ["oath", "charm"])


# ══════════════════════════════════════════════
# Engine: Forge Skill (sync fallback)
# ══════════════════════════════════════════════


class TestForgeSkillSync:
    def _make_full_session(self):
        s = SoulForgeSession(user_id="u1", phase="forging", current_scene=7)
        s.scene_choices = [
            SceneChoice(scene_id=1, choice_index=0,
                        signal_tags={"void_anchor": "connection",
                                     "attachment_style": "relational"}),
            SceneChoice(scene_id=2, choice_index=1,
                        signal_tags={"moral_core": "sacrifice",
                                     "decision_pattern": "empathetic"}),
            SceneChoice(scene_id=3, choice_index=0, signal_tags={}),
            SceneChoice(scene_id=4, choice_index=0, signal_tags={}),
        ]
        s.raw_response_times = [3000, 5000, 4000, 7000]
        s.raw_hover_counts = [2, 3, 1, 4]
        s.soul_fragment_raw = "Family"
        s.fragment_typing_time_ms = 5000
        return s

    def test_returns_unique_skill(self):
        s = self._make_full_session()
        skill = forge_skill_sync(s)
        assert isinstance(skill, UniqueSkill)
        assert skill.name != ""
        assert skill.category != ""

    def test_skill_has_timestamp(self):
        s = self._make_full_session()
        skill = forge_skill_sync(s)
        assert skill.forge_timestamp is not None

    def test_skill_has_trait_tags(self):
        s = self._make_full_session()
        skill = forge_skill_sync(s)
        assert isinstance(skill.trait_tags, list)

    def test_skill_resilience_defaults(self):
        s = self._make_full_session()
        skill = forge_skill_sync(s)
        assert skill.resilience == 100.0
        assert skill.instability == 0.0
        assert skill.is_revealed is False

    def test_different_paths_different_skills(self):
        """Two different paths should produce different skill names."""
        s1 = SoulForgeSession(user_id="u1", phase="forging")
        s1.scene_choices = [
            SceneChoice(scene_id=1, choice_index=0,
                        signal_tags={"void_anchor": "connection"}),
            SceneChoice(scene_id=2, choice_index=0,
                        signal_tags={"moral_core": "loyalty"}),
            SceneChoice(scene_id=3, choice_index=0, signal_tags={}),
            SceneChoice(scene_id=4, choice_index=0, signal_tags={}),
        ]
        s1.raw_response_times = [3000, 3000, 3000, 3000]
        s1.raw_hover_counts = [1, 1, 1, 1]
        s1.soul_fragment_raw = "Bonds"
        s1.fragment_typing_time_ms = 5000

        s2 = SoulForgeSession(user_id="u2", phase="forging")
        s2.scene_choices = [
            SceneChoice(scene_id=1, choice_index=3,
                        signal_tags={"void_anchor": "silence"}),
            SceneChoice(scene_id=2, choice_index=0,
                        signal_tags={"moral_core": "curiosity"}),
            SceneChoice(scene_id=3, choice_index=0, signal_tags={}),
            SceneChoice(scene_id=4, choice_index=0, signal_tags={}),
        ]
        s2.raw_response_times = [1000, 1000, 1000, 1000]
        s2.raw_hover_counts = [0, 0, 0, 0]
        s2.soul_fragment_raw = "Silence"
        s2.fragment_typing_time_ms = 2000

        skill1 = forge_skill_sync(s1)
        skill2 = forge_skill_sync(s2)
        assert skill1.name != skill2.name


# ══════════════════════════════════════════════
# Integration: Full Flow
# ══════════════════════════════════════════════


class TestFullFlow:
    def test_complete_flow_produces_skill(self):
        """Simulate the entire flow: 4 choices → fragment → forge."""
        s = SoulForgeSession(user_id="integration-test")

        # Scene 1 → choice
        scene1 = get_scene(s)
        assert scene1.scene_id == 1
        s = process_choice(s, 0, 3000, 2)

        # Scene 2 → choice
        scene2 = get_scene(s)
        assert scene2.scene_id == 2
        s = process_choice(s, 1, 5000, 1)

        # Scene 3 → choice
        scene3 = get_scene(s)
        assert scene3.scene_id == 3
        s = process_choice(s, 0, 4000, 3)

        # Scene 4 → choice
        scene4 = get_scene(s)
        assert scene4.scene_id == 4
        s = process_choice(s, 2, 7000, 0)

        # Scene 5 → advance
        scene5 = get_scene(s)
        assert scene5.scene_id == 5
        assert scene5.choices == []
        s = process_scene5_advance(s)

        # Fragment
        assert s.phase == "fragment"
        s = process_soul_fragment(s, "Su that la tat ca", typing_time_ms=10000, revision_count=2)
        assert s.phase == "forging"

        # Forge
        skill = forge_skill_sync(s)
        assert isinstance(skill, UniqueSkill)
        assert skill.name != ""
        assert skill.category in [
            "manifestation", "manipulation", "contract",
            "perception", "obfuscation",
        ]
        assert skill.forge_timestamp is not None


# ══════════════════════════════════════════════
# Engine: Name Similarity Check
# ══════════════════════════════════════════════


class TestIsNameTooSimilar:
    def test_empty_existing_is_never_similar(self):
        assert _is_name_too_similar("Any Name", set()) is False

    def test_exact_match(self):
        assert _is_name_too_similar("Sợi Dây Trung Thành", {"Sợi Dây Trung Thành"}) is True

    def test_case_insensitive_match(self):
        assert _is_name_too_similar("sợi dây trung thành", {"Sợi Dây Trung Thành"}) is True

    def test_substring_match(self):
        assert _is_name_too_similar("Bão Trí Tuệ Cuồng Nộ", {"Bão Trí Tuệ"}) is True

    def test_substring_reverse(self):
        assert _is_name_too_similar("Bão Trí", {"Bão Trí Tuệ"}) is True

    def test_word_overlap_above_60(self):
        # 2/3 words overlap = 66%
        assert _is_name_too_similar("Lửa Trời Xanh", {"Lửa Trời Đỏ"}) is True

    def test_completely_different_is_not_similar(self):
        assert _is_name_too_similar("Vọng Âm Hư Vô", {"Sợi Dây Trung Thành"}) is False

    def test_short_names_no_substring_false_positive(self):
        # Very short names (<=3 chars) skip substring check
        assert _is_name_too_similar("AB", {"CD"}) is False


# ══════════════════════════════════════════════
# Engine: Retry Prompt Builder
# ══════════════════════════════════════════════


class TestBuildRetryPrompt:
    def test_retry_1_mentions_rejected_names(self):
        signals = IdentitySignals(void_anchor="connection")
        result = _build_retry_prompt("base prompt", 1, ["Skill A"], signals)
        assert "Skill A" in result
        assert "HOÀN TOÀN KHÁC" in result

    def test_retry_2_has_chaos_factor(self):
        signals = IdentitySignals(void_anchor="connection")
        result = _build_retry_prompt("base prompt", 2, ["Skill A", "Skill B"], signals)
        assert "Chaos Factor" in result
        assert "Skill A" in result
        assert "Skill B" in result

    def test_retry_3_allows_category_break(self):
        signals = IdentitySignals(void_anchor="connection")
        result = _build_retry_prompt("base prompt", 3, ["A", "B", "C"], signals)
        assert "PHÂY 1 QUY TẮC" in result
        assert "ĐỘC NHẤT" in result


# ══════════════════════════════════════════════
# Engine: Embedding-Based Uniqueness
# ══════════════════════════════════════════════


class TestCosineAndEmbedding:
    def test_cosine_identical(self):
        from app.engine.skill_uniqueness import cosine_similarity
        a = [1.0, 0.0, 0.0]
        assert cosine_similarity(a, a) == pytest.approx(1.0)

    def test_cosine_orthogonal(self):
        from app.engine.skill_uniqueness import cosine_similarity
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        assert cosine_similarity(a, b) == pytest.approx(0.0)

    def test_cosine_opposite(self):
        from app.engine.skill_uniqueness import cosine_similarity
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_cosine_empty(self):
        from app.engine.skill_uniqueness import cosine_similarity
        assert cosine_similarity([], []) == 0.0

    def test_hash_embedding_deterministic(self):
        from app.engine.skill_uniqueness import _hash_embedding
        e1 = _hash_embedding("test text")
        e2 = _hash_embedding("test text")
        assert e1 == e2

    def test_hash_embedding_different_texts(self):
        from app.engine.skill_uniqueness import _hash_embedding
        e1 = _hash_embedding("Vết Nứt Sự Thật")
        e2 = _hash_embedding("Sợi Dây Bất Diệt")
        assert e1 != e2

    def test_hash_embedding_has_768_dims(self):
        from app.engine.skill_uniqueness import _hash_embedding
        e = _hash_embedding("test")
        assert len(e) == 768

    def test_hash_embedding_unit_norm(self):
        from app.engine.skill_uniqueness import _hash_embedding
        import math
        e = _hash_embedding("test")
        norm = math.sqrt(sum(x * x for x in e))
        assert norm == pytest.approx(1.0, abs=0.01)

    def test_similar_texts_have_low_similarity_with_hash(self):
        """Hash fallback isn't semantically aware, so similar text != high cosine."""
        from app.engine.skill_uniqueness import _hash_embedding, cosine_similarity
        e1 = _hash_embedding("Nhìn thấy vết nứt trong hiện thực")
        e2 = _hash_embedding("Tạo liên kết vô hình với 1 người")
        sim = cosine_similarity(e1, e2)
        # Hash-based, shouldn't be super high
        assert sim < 0.9


# ══════════════════════════════════════════════
# Engine: Scene 5 AI Summary
# ══════════════════════════════════════════════


class TestScene5Summary:
    def test_prompt_includes_choices(self):
        s = SoulForgeSession(user_id="u1")
        s.scene_choices = [
            SceneChoice(
                scene_id=1, choice_index=0,
                choice_text="Sợi dây kết nối",
                signal_tags={"void_anchor": "connection"},
            ),
            SceneChoice(
                scene_id=2, choice_index=1,
                choice_text="Đến đứa trẻ",
                signal_tags={"moral_core": "sacrifice"},
            ),
        ]
        prompt = _build_scene5_summary_prompt(s)
        assert "connection" in prompt
        assert "sacrifice" in prompt
        assert "Sợi dây kết nối" in prompt

    def test_prompt_empty_choices(self):
        s = SoulForgeSession(user_id="u1")
        s.scene_choices = []
        prompt = _build_scene5_summary_prompt(s)
        assert "Hư Vô" in prompt  # Prompt still has context

    @pytest.mark.asyncio
    async def test_fallback_on_no_choices(self):
        s = SoulForgeSession(user_id="u1")
        s.scene_choices = []
        from app.engine.soul_forge import _SCENE_5
        result = await generate_scene5_summary(s, None)
        assert result == _SCENE_5["text"]

    @pytest.mark.asyncio
    async def test_fallback_on_llm_error(self):
        from unittest.mock import AsyncMock
        s = SoulForgeSession(user_id="u1")
        s.scene_choices = [
            SceneChoice(scene_id=1, choice_index=0, choice_text="Test"),
        ]
        mock_llm = AsyncMock()
        mock_llm.ainvoke.side_effect = Exception("API Error")
        from app.engine.soul_forge import _SCENE_5
        result = await generate_scene5_summary(s, mock_llm)
        assert result == _SCENE_5["text"]
