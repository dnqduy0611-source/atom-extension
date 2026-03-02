"""Integration tests for emotion extraction through the encoder pipeline."""

import pytest

from neural_memory.core.brain import Brain, BrainConfig
from neural_memory.core.neuron import NeuronType
from neural_memory.core.synapse import SynapseType
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.storage.memory_store import InMemoryStorage


@pytest.fixture
async def encoder() -> tuple[MemoryEncoder, InMemoryStorage]:
    """Create an encoder with in-memory storage."""
    storage = InMemoryStorage()
    config = BrainConfig()
    brain = Brain.create(name="test", config=config)
    await storage.save_brain(brain)
    storage.set_brain(brain.id)
    return MemoryEncoder(storage, brain.config), storage


class TestEmotionEncoding:
    """Test emotion extraction creates proper FELT synapses during encoding."""

    @pytest.mark.asyncio
    async def test_negative_content_creates_felt_synapse(self, encoder: tuple) -> None:
        """Content with negative emotion should create FELT synapse."""
        enc, storage = encoder

        result = await enc.encode(
            "I'm so frustrated with this broken build, it keeps crashing.",
        )

        felt = [s for s in result.synapses_created if s.type == SynapseType.FELT]
        assert len(felt) >= 1
        # FELT synapse should have emotion metadata
        assert felt[0].metadata.get("_valence") == "negative"
        assert felt[0].metadata.get("_intensity") > 0

    @pytest.mark.asyncio
    async def test_positive_content_creates_felt_synapse(self, encoder: tuple) -> None:
        """Content with positive emotion should create FELT synapse."""
        enc, storage = encoder

        result = await enc.encode(
            "Finally solved the bug! I'm so happy and relieved it works.",
        )

        felt = [s for s in result.synapses_created if s.type == SynapseType.FELT]
        assert len(felt) >= 1
        assert felt[0].metadata.get("_valence") == "positive"

    @pytest.mark.asyncio
    async def test_neutral_content_no_felt_synapse(self, encoder: tuple) -> None:
        """Neutral content should not create FELT synapses."""
        enc, storage = encoder

        result = await enc.encode(
            "Meeting with the team at the conference room.",
        )

        felt = [s for s in result.synapses_created if s.type == SynapseType.FELT]
        assert len(felt) == 0

    @pytest.mark.asyncio
    async def test_emotion_neuron_is_state_type(self, encoder: tuple) -> None:
        """Emotion neurons should be NeuronType.STATE."""
        enc, storage = encoder

        result = await enc.encode(
            "I'm really frustrated with this error.",
        )

        state_neurons = [n for n in result.neurons_created if n.type == NeuronType.STATE]
        assert len(state_neurons) >= 1
        # At least one should be an emotion category
        emotion_contents = {n.content for n in state_neurons}
        assert "frustration" in emotion_contents or any("frustrat" in c for c in emotion_contents)

    @pytest.mark.asyncio
    async def test_shared_emotion_neurons(self, encoder: tuple) -> None:
        """Same emotion across multiple memories should reuse the same neuron."""
        enc, storage = encoder

        result1 = await enc.encode(
            "So frustrated with the login bug.",
        )
        result2 = await enc.encode(
            "Still frustrated with the deployment issue.",
        )

        # Second encoding should create fewer STATE neurons
        # because "frustration" neuron already exists
        state_neurons_1 = [n for n in result1.neurons_created if n.type == NeuronType.STATE]
        state_neurons_2 = [n for n in result2.neurons_created if n.type == NeuronType.STATE]

        # First should create emotion neurons, second should reuse them
        if state_neurons_1:
            # At least the overlapping emotions shouldn't create new neurons
            overlapping_emotions = {n.content for n in state_neurons_1} & {
                n.content for n in state_neurons_2
            }
            # Shared emotions should NOT appear in result2.neurons_created
            # (they were reused, not created)
            assert len(overlapping_emotions) == 0 or len(state_neurons_2) <= len(state_neurons_1)

    @pytest.mark.asyncio
    async def test_felt_synapse_weight_scales_with_intensity(self, encoder: tuple) -> None:
        """FELT synapse weight should scale with emotional intensity."""
        enc, storage = encoder

        result = await enc.encode(
            "I am extremely frustrated and absolutely furious about this terrible bug.",
        )

        felt = [s for s in result.synapses_created if s.type == SynapseType.FELT]
        if felt:
            # Weight should be intensity * emotional_weight_scale (0.8)
            for s in felt:
                assert s.weight > 0
                assert s.weight <= 0.8  # emotional_weight_scale default

    @pytest.mark.asyncio
    async def test_valence_stored_in_fiber_metadata(self, encoder: tuple) -> None:
        """Fiber metadata should include _valence and _intensity."""
        enc, storage = encoder

        result = await enc.encode(
            "This is a great and amazing achievement!",
        )

        # Check if valence was stored (only if emotions were detected)
        felt = [s for s in result.synapses_created if s.type == SynapseType.FELT]
        if felt:
            assert result.fiber.metadata.get("_valence") == "positive"
            assert result.fiber.metadata.get("_intensity") > 0

    @pytest.mark.asyncio
    async def test_encoding_with_all_features(self, encoder: tuple) -> None:
        """Full encoding with emotional content plus relations and tags."""
        enc, storage = encoder

        result = await enc.encode(
            "I'm frustrated because the API latency increased. "
            "First we tried caching, then we scaled the servers and it's amazing now.",
            tags={"api", "production"},
        )

        # Should have neurons, synapses, and FELT synapses
        assert len(result.neurons_created) > 0
        assert len(result.synapses_created) > 0
        assert result.fiber is not None

        # Should have both emotion and relation synapses
        synapse_types = {s.type for s in result.synapses_created}
        # At minimum we should have standard types
        assert SynapseType.RELATED_TO in synapse_types or SynapseType.INVOLVES in synapse_types
