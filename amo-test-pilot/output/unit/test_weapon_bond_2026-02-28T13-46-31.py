```python
import pytest
from app.models.weapon import Weapon, WeaponBondEvent, WeaponGrade

@pytest.fixture
def resonant_weapon() -> Weapon:
    return Weapon(
        grade=WeaponGrade.resonant,
        bond_score=75.0,
        soul_linked=False,
        dormant=False,
        primary_principle="order",
        secondary_principle="energy",
        bond_events=[],
    )

@pytest.fixture
def soul_linked_weapon() -> Weapon:
    return Weapon(
        grade=WeaponGrade.soul_linked,
        bond_score=85.0,
        soul_linked=True,
        dormant=False,
        primary_principle="entropy",
        secondary_principle="void",
        bond_events=[],
    )

def test_get_bond_delta_valid_event():
    assert get_bond_delta("combat_encounter") == 4.0

def test_get_bond_delta_invalid_event():
    assert get_bond_delta("invalid_event") == 0.0

def test_get_bond_cap_pre_awakened(resonant_weapon):
    assert get_bond_cap(resonant_weapon) == 100.0

def test_get_bond_cap_post_awakened(soul_linked_weapon):
    soul_linked_weapon.grade = WeaponGrade.awakened
    assert get_bond_cap(soul_linked_weapon) == 150.0

def test_update_bond_score_mundane_weapon():
    weapon = Weapon(grade=WeaponGrade.mundane, bond_score=0.0)
    assert update_bond_score(weapon, "combat_encounter") == 0.0

def test_update_bond_score_valid_event(resonant_weapon):
    new_score = update_bond_score(resonant_weapon, "combat_encounter", chapter=1, description="Test")
    assert new_score == 79.0
    assert len(resonant_weapon.bond_events) == 1

def test_apply_bond_decay_unused(resonant_weapon):
    resonant_weapon.bond_score = 50.0
    assert apply_bond_decay(resonant_weapon, chapters_unused=3) == 45.0

def test_apply_bond_decay_misaligned(resonant_weapon):
    resonant_weapon.bond_score = 50.0
    assert apply_bond_decay(resonant_weapon, principle_misaligned=True) == 47.0

def test_check_soul_link_threshold_met(resonant_weapon):
    resonant_weapon.bond_score = 80.0
    assert check_soul_link_threshold(resonant_weapon) is True

def test_check_soul_link_threshold_not_met(resonant_weapon):
    resonant_weapon.bond_score = 79.0
    assert check_soul_link_threshold(resonant_weapon) is False

def test_check_awakening_threshold_met(soul_linked_weapon):
    assert check_awakening_threshold(soul_linked_weapon) is True

def test_check_awakening_threshold_not_met(soul_linked_weapon):
    soul_linked_weapon.bond_score = 84.0
    assert check_awakening_threshold(soul_linked_weapon) is False

def test_apply_soul_link_valid(resonant_weapon):
    weapon = apply_soul_link(resonant_weapon)
    assert weapon.grade == WeaponGrade.soul_linked
    assert weapon.soul_linked is True

def test_apply_soul_link_invalid(soul_linked_weapon):
    weapon = apply_soul_link(soul_linked_weapon)
    assert weapon.grade == WeaponGrade.soul_linked

def test_apply_dormant_valid(soul_linked_weapon):
    weapon = apply_dormant(soul_linked_weapon)
    assert weapon.dormant is True

def test_apply_dormant_invalid(resonant_weapon):
    weapon = apply_dormant(resonant_weapon)
    assert weapon.dormant is False

def test_recover_from_dormant(soul_linked_weapon):
    soul_linked_weapon.dormant = True
    weapon = recover_from_dormant(soul_linked_weapon)
    assert weapon.dormant is False

def test_get_awakened_passive_valid():
    assert get_awakened_passive("order", "energy") == ("Law of Force", "+3% damage khi HP > 70%")

def test_get_awakened_passive_invalid():
    assert get_awakened_passive("order", "void") is None

def test_apply_awakening_valid(soul_linked_weapon):
    weapon = apply_awakening(soul_linked_weapon)
    assert weapon.grade == WeaponGrade.awakened
    assert weapon.awakened_passive == "Abyssal Hunger"

def test_apply_awakening_invalid(resonant_weapon):
    weapon = apply_awakening(resonant_weapon)
    assert weapon.grade == WeaponGrade.resonant
```