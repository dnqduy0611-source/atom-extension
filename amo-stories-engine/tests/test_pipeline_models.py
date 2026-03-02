"""Tests for pipeline I/O models."""

from app.models.pipeline import (
    Beat, PlannerOutput, SimulatorOutput, WriterOutput,
    CriticOutput, NarrativeState,
)
from app.models.story import Choice


class TestBeat:
    def test_defaults(self):
        b = Beat()
        assert b.description == ""
        assert b.tension == 5
        assert b.purpose == "rising"
        assert b.estimated_words == 400

    def test_custom(self):
        b = Beat(description="Fight scene", tension=9, purpose="climax", mood="action")
        assert b.tension == 9


class TestPlannerOutput:
    def test_defaults(self):
        p = PlannerOutput()
        assert p.beats == []
        assert p.chapter_tension == 5
        assert p.emotional_arc == "growth"

    def test_with_beats(self):
        p = PlannerOutput(
            beats=[Beat(description="intro"), Beat(description="conflict")],
            chapter_tension=8,
        )
        assert len(p.beats) == 2


class TestSimulatorOutput:
    def test_defaults(self):
        s = SimulatorOutput()
        assert s.consequences == []
        assert s.relationship_changes == []
        assert s.identity_alignment == {}

    def test_with_data(self):
        s = SimulatorOutput(
            consequences=[{"type": "reputation", "effect": "increase"}],
            world_impact="Major shift in power balance",
        )
        assert len(s.consequences) == 1
        assert s.world_impact != ""


class TestWriterOutput:
    def test_defaults(self):
        w = WriterOutput()
        assert w.prose == ""
        assert w.choices == []
        assert w.chapter_title == ""
        assert w.summary == ""

    def test_with_choices(self):
        w = WriterOutput(
            prose="Some prose text",
            choices=[Choice(text="Option A", risk_level=2)],
            chapter_title="Test Chapter",
        )
        assert len(w.choices) == 1


class TestCriticOutput:
    def test_defaults(self):
        c = CriticOutput()
        assert c.score == 0.0
        assert c.approved is False
        assert c.feedback == {}
        assert c.issues == []

    def test_approved(self):
        c = CriticOutput(score=8.5, approved=True)
        assert c.approved

    def test_with_issues(self):
        c = CriticOutput(
            score=5.0,
            issues=["Prose too short", "Missing Vietnamese flavor"],
            rewrite_instructions="Add more detail to scene 2",
        )
        assert len(c.issues) == 2


class TestNarrativeState:
    def test_defaults(self):
        ns = NarrativeState()
        assert ns.story_id == ""
        assert ns.chapter_number == 1
        assert ns.final_prose == ""
        assert ns.final_choices == []
        assert ns.rewrite_count == 0

    def test_full_state(self):
        ns = NarrativeState(
            story_id="s1",
            chapter_number=3,
            preference_tags=["combat", "mystery"],
            backstory="A former warrior",
            final_prose="Prose here",
            final_choices=[Choice(text="A")],
        )
        assert ns.preference_tags == ["combat", "mystery"]
        assert ns.backstory == "A former warrior"
        assert len(ns.final_choices) == 1
