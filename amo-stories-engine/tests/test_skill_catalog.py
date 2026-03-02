"""Tests for the Skill Catalog — models, 72 skeletons, and helpers.

Validates:
- Catalog completeness (72 skills, 12 per principle)
- Archetype distribution per principle
- No duplicate IDs
- Tier 2 integration templates (15 pairs)
- Query helpers
- Data model construction
"""

import pytest

from app.models.skill_catalog import (
    PRINCIPLE_PAIR_TEMPLATES,
    SKILL_CATALOG,
    DamageType,
    DeliveryType,
    NarrativeSkin,
    PlayerSkill,
    PrinciplePairTemplate,
    SkillArchetype,
    SkillSkeleton,
    get_pair_template,
    get_skill,
    get_skills_by_archetype,
    get_skills_by_principle,
    get_skills_by_tag,
)

PRINCIPLES = ["order", "entropy", "matter", "flux", "energy", "void"]


# ════════════════════════════════════════════
# Catalog Completeness
# ════════════════════════════════════════════

class TestCatalogCompleteness:
    """Verify the catalog has exactly 72 skills with correct distribution."""

    def test_total_skills(self):
        assert len(SKILL_CATALOG) == 72

    @pytest.mark.parametrize("principle", PRINCIPLES)
    def test_skills_per_principle(self, principle: str):
        skills = get_skills_by_principle(principle)
        assert len(skills) == 12, (
            f"{principle} has {len(skills)} skills, expected 12"
        )

    @pytest.mark.parametrize("principle", PRINCIPLES)
    def test_archetype_distribution(self, principle: str):
        """Each principle: 4 offensive, 3 defensive, 3 support, 2 specialist."""
        skills = get_skills_by_principle(principle)
        counts = {}
        for sk in skills:
            counts[sk.archetype] = counts.get(sk.archetype, 0) + 1

        assert counts.get(SkillArchetype.OFFENSIVE, 0) == 4, (
            f"{principle}: offensive = {counts.get(SkillArchetype.OFFENSIVE, 0)}"
        )
        assert counts.get(SkillArchetype.DEFENSIVE, 0) == 3, (
            f"{principle}: defensive = {counts.get(SkillArchetype.DEFENSIVE, 0)}"
        )
        assert counts.get(SkillArchetype.SUPPORT, 0) == 3, (
            f"{principle}: support = {counts.get(SkillArchetype.SUPPORT, 0)}"
        )
        assert counts.get(SkillArchetype.SPECIALIST, 0) == 2, (
            f"{principle}: specialist = {counts.get(SkillArchetype.SPECIALIST, 0)}"
        )

    def test_no_duplicate_ids(self):
        ids = list(SKILL_CATALOG.keys())
        assert len(ids) == len(set(ids)), "Duplicate skill IDs found"

    def test_no_duplicate_names(self):
        names = [sk.catalog_name for sk in SKILL_CATALOG.values()]
        assert len(names) == len(set(names)), "Duplicate catalog names found"

    def test_all_ids_follow_convention(self):
        """IDs follow pattern: {principle}_{type}_{number}."""
        for skill_id, sk in SKILL_CATALOG.items():
            parts = skill_id.split("_")
            assert len(parts) == 3, f"Bad ID format: {skill_id}"
            assert parts[0] == sk.principle, (
                f"ID prefix '{parts[0]}' != principle '{sk.principle}'"
            )
            assert parts[1] in ("off", "def", "sup", "spe"), (
                f"Unknown archetype code in ID: {parts[1]}"
            )


# ════════════════════════════════════════════
# Damage Type Coverage
# ════════════════════════════════════════════

class TestDamageTypes:
    """Verify damage type assignments follow spec rules."""

    def test_matter_skills_are_structural_or_none(self):
        for sk in get_skills_by_principle("matter"):
            assert sk.damage_type in (DamageType.STRUCTURAL, DamageType.NONE), (
                f"Matter skill {sk.id} has unexpected damage_type {sk.damage_type}"
            )

    def test_energy_skills_are_structural_or_none(self):
        for sk in get_skills_by_principle("energy"):
            assert sk.damage_type in (DamageType.STRUCTURAL, DamageType.NONE), (
                f"Energy skill {sk.id} has unexpected damage_type {sk.damage_type}"
            )

    def test_entropy_skills_are_stability_or_none(self):
        for sk in get_skills_by_principle("entropy"):
            assert sk.damage_type in (DamageType.STABILITY, DamageType.NONE), (
                f"Entropy skill {sk.id} has unexpected damage_type {sk.damage_type}"
            )

    def test_flux_skills_are_stability_structural_or_none(self):
        """Flux may have stability OR structural (Vector Strike, Momentum Surge)."""
        for sk in get_skills_by_principle("flux"):
            assert sk.damage_type in (
                DamageType.STABILITY, DamageType.STRUCTURAL, DamageType.NONE,
            ), f"Flux skill {sk.id} has unexpected damage_type {sk.damage_type}"

    def test_void_skills_are_denial_or_none(self):
        for sk in get_skills_by_principle("void"):
            assert sk.damage_type in (DamageType.DENIAL, DamageType.NONE), (
                f"Void skill {sk.id} has unexpected damage_type {sk.damage_type}"
            )

    def test_order_can_be_structural_stability_or_none(self):
        """Order is the flexible principle — can be structural or stability."""
        for sk in get_skills_by_principle("order"):
            assert sk.damage_type in (
                DamageType.STRUCTURAL, DamageType.STABILITY, DamageType.NONE,
            ), f"Order skill {sk.id} has unexpected damage_type {sk.damage_type}"


# ════════════════════════════════════════════
# Skeleton Fields
# ════════════════════════════════════════════

class TestSkeletonFields:
    """Every skill has valid, non-empty required fields."""

    @pytest.mark.parametrize("skill_id", list(SKILL_CATALOG.keys()))
    def test_required_fields_filled(self, skill_id: str):
        sk = SKILL_CATALOG[skill_id]
        assert sk.id, "id is empty"
        assert sk.catalog_name, "catalog_name is empty"
        assert sk.principle in PRINCIPLES, f"principle '{sk.principle}' invalid"
        assert sk.mechanic, "mechanic is empty"
        assert sk.limitation, "limitation is empty"
        assert sk.weakness, "weakness is empty"
        assert isinstance(sk.tags, list), "tags must be a list"


# ════════════════════════════════════════════
# Integration Templates
# ════════════════════════════════════════════

class TestIntegrationTemplates:
    """Verify all 15 principle pair templates."""

    def test_template_count(self):
        assert len(PRINCIPLE_PAIR_TEMPLATES) == 15

    def test_all_unique_pairs_covered(self):
        """6 principles → 15 unique pairs (C(6,2) = 15)."""
        expected_pairs: set[tuple[str, str]] = set()
        for i, a in enumerate(PRINCIPLES):
            for b in PRINCIPLES[i + 1:]:
                expected_pairs.add((a, b))

        assert len(expected_pairs) == 15

        for pair in expected_pairs:
            template = get_pair_template(pair[0], pair[1])
            assert template is not None, (
                f"Missing template for pair: {pair}"
            )

    def test_pair_lookup_order_independent(self):
        """(order, entropy) should return same template as (entropy, order)."""
        t1 = get_pair_template("order", "entropy")
        t2 = get_pair_template("entropy", "order")
        assert t1 is not None
        assert t2 is not None
        assert t1.archetype_blend == t2.archetype_blend

    def test_opposing_pairs_have_high_instability(self):
        opposing = [("order", "entropy"), ("matter", "flux"), ("energy", "void")]
        for pair in opposing:
            template = get_pair_template(*pair)
            assert template is not None
            assert template.instability_cost == "high"
            assert template.power_multiplier == 1.4

    def test_adjacent_pairs_have_low_instability(self):
        adjacent = [
            ("order", "matter"), ("order", "energy"),
            ("entropy", "flux"), ("entropy", "void"),
            ("matter", "energy"), ("flux", "void"),
        ]
        for pair in adjacent:
            template = get_pair_template(*pair)
            assert template is not None
            assert template.instability_cost == "low"
            assert template.power_multiplier == 1.1

    def test_cross_cluster_pairs_have_moderate_instability(self):
        cross = [
            ("order", "flux"), ("order", "void"),
            ("entropy", "matter"), ("entropy", "energy"),
            ("matter", "void"), ("flux", "energy"),
        ]
        for pair in cross:
            template = get_pair_template(*pair)
            assert template is not None
            assert template.instability_cost == "moderate"
            assert template.power_multiplier == 1.2


# ════════════════════════════════════════════
# Query Helpers
# ════════════════════════════════════════════

class TestQueryHelpers:

    def test_get_skills_by_principle(self):
        order_skills = get_skills_by_principle("order")
        assert all(sk.principle == "order" for sk in order_skills)
        assert len(order_skills) == 12

    def test_get_skills_by_archetype(self):
        offensive = get_skills_by_archetype("offensive")
        assert all(sk.archetype == SkillArchetype.OFFENSIVE for sk in offensive)
        assert len(offensive) == 24  # 4 per principle × 6

    def test_get_skills_by_tag(self):
        melee_skills = get_skills_by_tag("melee")
        assert all("melee" in sk.tags for sk in melee_skills)
        assert len(melee_skills) > 0

    def test_get_skill_existing(self):
        sk = get_skill("order_off_01")
        assert sk is not None
        assert sk.catalog_name == "Order Strike"

    def test_get_skill_nonexistent(self):
        assert get_skill("nonexistent_99") is None


# ════════════════════════════════════════════
# Data Models
# ════════════════════════════════════════════

class TestDataModels:
    """Verify data model construction and defaults."""

    def test_narrative_skin_defaults(self):
        skin = NarrativeSkin()
        assert skin.display_name == ""
        assert skin.description == ""
        assert skin.discovery_line == ""

    def test_narrative_skin_with_values(self):
        skin = NarrativeSkin(
            display_name="Oath Wall",
            description="A barrier born from the promise.",
            discovery_line="It appeared the moment you thought of her.",
        )
        assert skin.display_name == "Oath Wall"

    def test_player_skill_creation(self):
        ps = PlayerSkill(skeleton_id="matter_def_01")
        assert ps.skeleton_id == "matter_def_01"
        assert ps.usage_count == 0
        assert ps.refined is False
        assert ps.mutated is False
        assert ps.awakened_principle == ""

    def test_player_skill_with_narrative(self):
        ps = PlayerSkill(
            skeleton_id="order_off_01",
            narrative=NarrativeSkin(
                display_name="Rule Hammer",
                description="The law strikes first.",
            ),
            usage_count=5,
        )
        assert ps.narrative.display_name == "Rule Hammer"
        assert ps.usage_count == 5

    def test_principle_pair_template(self):
        t = PrinciplePairTemplate(
            archetype_blend="test",
            mechanic_pattern="test_pattern",
            instability_cost="low",
            power_multiplier=1.0,
            flavor="test flavor",
        )
        assert t.power_multiplier == 1.0

    def test_damage_type_enum(self):
        assert DamageType.STRUCTURAL.value == "structural"
        assert DamageType.STABILITY.value == "stability"
        assert DamageType.DENIAL.value == "denial"
        assert DamageType.NONE.value == "none"

    def test_delivery_type_enum(self):
        assert len(DeliveryType) == 5
        assert DeliveryType.MELEE.value == "melee"
        assert DeliveryType.FIELD.value == "field"

    def test_skill_archetype_enum(self):
        assert len(SkillArchetype) == 4
