"""Tests for story, player, and identity models."""

from app.models.story import (
    Chapter, Choice, PreferenceTag, Story,
    StartRequest, ContinueRequest, StartResponse, ContinueResponse,
    ChapterResponse, ChoiceResponse, StoryStateResponse,
)
from app.models.player import (
    PlayerState, SeedIdentity, CurrentIdentity, LatentIdentity,
    DNAAffinityTag, Archetype,
)
from app.models.identity import (
    IdentityDelta, IdentityEvent, IdentityEventType, PlayerFlag,
)


class TestPreferenceTag:
    def test_all_tags_have_display_names(self):
        for t in PreferenceTag:
            assert t.display_name, f"PreferenceTag {t.value} missing display_name"

    def test_combat_display(self):
        assert PreferenceTag.COMBAT.display_name == "Chiến đấu"


class TestChoice:
    def test_defaults(self):
        c = Choice(text="Test choice")
        assert c.id  # auto-generated
        assert c.risk_level == 1
        assert c.consequence_hint == ""

    def test_risk_bounds(self):
        c = Choice(text="risky", risk_level=5)
        assert c.risk_level == 5

    def test_empty_text_allowed(self):
        c = Choice()  # text defaults to ""
        assert c.text == ""


class TestChapter:
    def test_defaults(self):
        ch = Chapter(story_id="s1", chapter_number=1)
        assert ch.id
        assert ch.prose == ""
        assert ch.choices == []
        assert ch.critic_score is None
        assert ch.rewrite_count == 0
        assert ch.title == ""
        assert ch.summary == ""

    def test_with_choices(self):
        ch = Chapter(
            story_id="s1",
            chapter_number=3,
            prose="Some prose",
            choices=[Choice(text="A"), Choice(text="B")],
        )
        assert len(ch.choices) == 2
        assert ch.chapter_number == 3


class TestStory:
    def test_defaults(self):
        s = Story(user_id="u1", preference_tags=["combat", "mystery"])
        assert s.id
        assert s.is_active
        assert s.chapter_count == 0
        assert s.brain_id == ""
        assert len(s.preference_tags) == 2

    def test_backstory(self):
        s = Story(user_id="u1", backstory="A former doctor")
        assert s.backstory == "A former doctor"
        assert s.preference_tags == []


class TestPlayerState:
    def test_defaults(self):
        p = PlayerState(
            user_id="u1",
            name="Test",
            seed_identity=SeedIdentity(
                core_values=["a"],
                personality_traits=["b"],
                motivation="m",
                fear="f",
            ),
            current_identity=CurrentIdentity(),
            latent_identity=LatentIdentity(),
            archetype="vanguard",
        )
        assert p.identity_coherence == 100.0
        assert p.instability == 0.0
        assert p.breakthrough_meter == 0.0
        assert p.fate_buffer == 100.0
        assert p.is_early_game is True

    def test_archetype_values(self):
        for a in Archetype:
            assert a.value  # all have non-empty values


class TestDNAAffinityTag:
    def test_all_tags(self):
        tags = list(DNAAffinityTag)
        assert len(tags) >= 5  # Should have several affinity tags


class TestIdentityDelta:
    def test_defaults(self):
        d = IdentityDelta()
        assert d.coherence_change == 0.0
        assert d.instability_change == 0.0
        assert d.dqs_change == 0.0
        assert d.confrontation_triggered is False
        assert d.new_flags == []

    def test_custom_delta(self):
        d = IdentityDelta(
            coherence_change=-5.0,
            instability_change=3.0,
            dqs_change=1.5,
            breakthrough_change=10.0,
            drift_detected="minor",
        )
        assert d.coherence_change == -5.0
        assert d.drift_detected == "minor"


class TestIdentityEvent:
    def test_creation(self):
        e = IdentityEvent(
            player_id="p1",
            event_type=IdentityEventType.DRIFT,
            chapter_number=5,
            description="test",
        )
        assert e.player_id == "p1"
        assert e.chapter_number == 5


class TestAPIModels:
    def test_start_request(self):
        r = StartRequest(user_id="u1", preference_tags=["combat", "romance"])
        assert r.preference_tags == ["combat", "romance"]
        assert r.backstory == ""
        assert r.quiz_answers is None

    def test_continue_request(self):
        r = ContinueRequest(story_id="s1", choice_id="c1")
        assert r.free_input == ""

    def test_chapter_response(self):
        cr = ChapterResponse(
            id="ch1", number=1, prose="text",
            choices=[ChoiceResponse(id="c1", text="opt", risk_level=2)],
        )
        assert cr.summary == ""
        assert cr.title == ""

    def test_continue_response(self):
        cr = ContinueResponse(
            story_id="s1",
            chapter=ChapterResponse(
                id="ch1", number=1, prose="text", choices=[],
            ),
        )
        assert cr.identity_update is None
