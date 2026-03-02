"""
Basic usage example for NeuralMemory.

This example demonstrates:
1. Creating a brain
2. Encoding memories
3. Querying memories through activation
"""

import asyncio
from datetime import datetime

from neural_memory.core.brain import Brain, BrainConfig
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.engine.retrieval import ReflexPipeline
from neural_memory.storage.memory_store import InMemoryStorage


async def main() -> None:
    # 1. Create storage and brain
    storage = InMemoryStorage()

    config = BrainConfig(
        decay_rate=0.1,
        activation_threshold=0.2,
        max_spread_hops=4,
        max_context_tokens=1000,
    )

    brain = Brain.create(name="my_agent_brain", config=config)
    await storage.save_brain(brain)
    storage.set_brain(brain.id)

    print(f"Created brain: {brain.name} (ID: {brain.id})")

    # 2. Create encoder and encode some memories
    encoder = MemoryEncoder(storage, config)

    memories = [
        ("Met with Alice at the coffee shop to discuss the API design", datetime(2024, 2, 3, 15, 0)),
        ("Alice suggested adding rate limiting to prevent abuse", datetime(2024, 2, 3, 15, 30)),
        ("Decided to use FastAPI for the backend implementation", datetime(2024, 2, 3, 16, 0)),
        ("Completed the authentication module, took 3 hours", datetime(2024, 2, 4, 10, 0)),
        ("Fixed bug in the login flow that was causing timeouts", datetime(2024, 2, 4, 14, 0)),
    ]

    print("\nEncoding memories...")
    for content, timestamp in memories:
        result = await encoder.encode(content, timestamp=timestamp)
        print(f"  - Encoded: {content[:50]}...")
        print(f"    Created {len(result.neurons_created)} neurons, {len(result.synapses_created)} synapses")

    # 3. Query memories
    pipeline = ReflexPipeline(storage, config)

    queries = [
        "What did Alice suggest?",
        "What was decided about the backend?",
        "What happened yesterday?",  # Relative to 2024-02-04
    ]

    print("\nQuerying memories...")
    for query in queries:
        result = await pipeline.query(
            query,
            reference_time=datetime(2024, 2, 4, 16, 0),  # "Now" is Feb 4, 4pm
        )

        print(f"\n  Query: {query}")
        print(f"  Answer: {result.answer}")
        print(f"  Confidence: {result.confidence:.2f}")
        print(f"  Neurons activated: {result.neurons_activated}")
        print(f"  Latency: {result.latency_ms:.2f}ms")

    # 4. Get brain statistics
    stats = await storage.get_stats(brain.id)
    print(f"\nBrain statistics:")
    print(f"  Neurons: {stats['neuron_count']}")
    print(f"  Synapses: {stats['synapse_count']}")
    print(f"  Fibers: {stats['fiber_count']}")


if __name__ == "__main__":
    asyncio.run(main())
