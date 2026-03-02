```python
import pytest
from unittest.mock import MagicMock
from app.models.weapon import Weapon, WeaponGrade
from app.models.pipeline import NarrativeState

# Fixtures
@pytest.fixture
def mock_player_state():
    return MagicMock()

@pytest.fixture
def mock_weapon():
    return MagicMock(spec=Weapon)

@pytest.fixture
def mock_planner_output():
    return MagicMock()

# Tests for extract_bond_events
def test_extract_bond_events_combat():
    events = extract_bond_events(action_category="combat", has_combat=True)
    assert "combat_encounter" in events

def test_extract_bond_events_social():
    events = extract_bond_events(action_category="social")
    assert "narrative_reference" in events

def test_extract_bond_events_turning_point():
    events = extract_bond_events(is_turning_point=True)
    assert "turning_point" in events

def test_extract_bond_events_near_death():
    events = extract_bond_events(near_death=True)
    assert "near_death" in events

def test_extract_bond_events_theft_attempt():
    events = extract_bond_events(theft_attempt=True)
    assert "theft_attempt_failed" in events

# Tests for compute_pre_combat_bonus
def test_compute_pre_combat_bonus_no_player_state():
    result = compute_pre_combat_bonus(None)
    assert result["effective_total"] == 0.0

def test_compute_pre_combat_bonus_no_weapons(mock_player_state):
    mock_player_state.equipped_weapons = None
    result = compute_pre_combat_bonus(mock_player_state)
    assert result["effective_total"] == 0.0

def test_compute_pre_combat_bonus_vanguard(mock_player_state, mock_weapon):
    mock_player_state.equipped_weapons = MagicMock(primary=mock_weapon, secondary=mock_weapon)
    mock_player_state.archetype = "vanguard"
    result = compute_pre_combat_bonus(mock_player_state)
    assert isinstance(result, dict)

# Tests for _get_player_skill_principle
def test_get_player_skill_principle_no_skill(mock_player_state):
    mock_player_state.unique_skill = None
    assert _get_player_skill_principle(mock_player_state) == ""

def test_get_player_skill_principle_with_skill(mock_player_state):
    mock_player_state.unique_skill = MagicMock(principle="test")
    assert _get_player_skill_principle(mock_player_state) == "test"

# Tests for apply_post_combat_drops
def test_apply_post_combat_drops_no_monster():
    result = apply_post_combat_drops()
    assert result["dropped_core"] is None

def test_apply_post_combat_drops_boss():
    result = apply_post_combat_drops(monster_tier="boss", is_boss=True)
    assert isinstance(result, dict)

# Tests for post_chapter_weapon_update
def test_post_chapter_weapon_update_no_player_state():
    result = post_chapter_weapon_update(None)
    assert result == {}

def test_post_chapter_weapon_update_with_weapon(mock_player_state, mock_weapon):
    mock_player_state.equipped_weapons = MagicMock(primary=mock_weapon)
    result = post_chapter_weapon_update(mock_player_state)
    assert isinstance(result, dict)

# Tests for _check_turning_point
def test_check_turning_point_no_planner_output():
    assert not _check_turning_point(None)

def test_check_turning_point_with_turning_point(mock_planner_output):
    mock_beat = MagicMock(is_turning_point=True)
    mock_planner_output.beats = [mock_beat]
    assert _check_turning_point(mock_planner_output)

# Tests for _safe_float
def test_safe_float_from_dict():
    assert _safe_float({"test": 1.0}, "test") == 1.0

def test_safe_float_from_object():
    obj = MagicMock(test=1.0)
    assert _safe_float(obj, "test") == 1.0

# Tests for _safe_str
def test_safe_str_from_dict():
    assert _safe_str({"test": "value"}, "test") == "value"

def test_safe_str_from_object():
    obj = MagicMock(test="value")
    assert _safe_str(obj, "test") == "value"

# Tests for _get_chapters_unused
def test_get_chapters_unused_no_events(mock_weapon, mock_player_state):
    mock_weapon.bond_events = []
    mock_player_state.total_chapters = 10
    assert _get_chapters_unused(mock_weapon, mock_player_state) == 10

def test_get_chapters_unused_with_events(mock_weapon, mock_player_state):
    mock_event = MagicMock(chapter=5)
    mock_weapon.bond_events = [mock_event]
    mock_player_state.total_chapters = 10
    assert _get_chapters_unused(mock_weapon, mock_player_state) == 5

# Tests for _get_current_season
def test_get_current_season_first_chapter(mock_player_state):
    mock_player_state.total_chapters = 1
    assert _get_current_season(mock_player_state) == 1

def test_get_current_season_multiple_seasons(mock_player_state):
    mock_player_state.total_chapters = 25
    assert _get_current_season(mock_player_state) == 2

# Tests for _get_latest_archon_signal
def test_get_latest_archon_signal_no_update():
    assert _get_latest_archon_signal({}) == ""

def test_get_latest_archon_signal_with_update():
    updates = {"archon_affinity_update": {"test": 1.0}}
    assert _get_latest_archon_signal(updates) == "test"
```