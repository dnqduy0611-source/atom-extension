"""
Brain sharing example for NeuralMemory.

This example demonstrates:
1. Creating and populating a brain
2. Exporting a brain snapshot
3. Importing a brain into another instance
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path

from neural_memory.core.brain import Brain, BrainConfig
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.engine.retrieval import ReflexPipeline
from neural_memory.storage.memory_store import InMemoryStorage


async def create_expert_brain() -> tuple[InMemoryStorage, Brain]:
    """Create a brain with expert knowledge."""
    storage = InMemoryStorage()
    config = BrainConfig()

    brain = Brain.create(
        name="python_expert",
        config=config,
        metadata={"domain": "Python programming", "version": "1.0"},
    )
    await storage.save_brain(brain)
    storage.set_brain(brain.id)

    encoder = MemoryEncoder(storage, config)

    # Add expert knowledge
    knowledge = [
        "Use list comprehensions for cleaner, more Pythonic code",
        "Always use type hints to improve code readability and catch bugs early",
        "Prefer f-strings over .format() or % formatting for string interpolation",
        "Use dataclasses for simple data containers instead of regular classes",
        "Context managers (with statements) ensure proper resource cleanup",
        "The walrus operator := can simplify assignment in conditionals",
        "Use pathlib.Path instead of os.path for file system operations",
        "asyncio is the standard way to write concurrent code in Python",
        "Use pytest for testing - it's more powerful than unittest",
        "Virtual environments isolate project dependencies",
    ]

    for item in knowledge:
        await encoder.encode(
            item,
            timestamp=datetime.now(),
            tags={"python", "best-practices"},
        )

    return storage, brain


async def export_brain(storage: InMemoryStorage, brain_id: str, output_path: str) -> None:
    """Export a brain to a JSON file."""
    snapshot = await storage.export_brain(brain_id)

    # Convert to dict for JSON serialization
    export_data = {
        "brain_id": snapshot.brain_id,
        "brain_name": snapshot.brain_name,
        "exported_at": snapshot.exported_at.isoformat(),
        "version": snapshot.version,
        "neurons": snapshot.neurons,
        "synapses": snapshot.synapses,
        "fibers": snapshot.fibers,
        "config": snapshot.config,
        "metadata": snapshot.metadata,
    }

    path = Path(output_path)
    path.write_text(json.dumps(export_data, indent=2, ensure_ascii=False))
    print(f"Exported brain to: {path}")


async def import_brain(storage: InMemoryStorage, input_path: str) -> str:
    """Import a brain from a JSON file."""
    from neural_memory.core.brain import BrainSnapshot

    path = Path(input_path)
    data = json.loads(path.read_text())

    snapshot = BrainSnapshot(
        brain_id=data["brain_id"],
        brain_name=data["brain_name"],
        exported_at=datetime.fromisoformat(data["exported_at"]),
        version=data["version"],
        neurons=data["neurons"],
        synapses=data["synapses"],
        fibers=data["fibers"],
        config=data["config"],
        metadata=data.get("metadata", {}),
    )

    brain_id = await storage.import_brain(snapshot)
    print(f"Imported brain: {brain_id}")
    return brain_id


async def main() -> None:
    print("=" * 60)
    print("NeuralMemory Brain Sharing Demo")
    print("=" * 60)

    # 1. Create expert brain
    print("\n1. Creating Python expert brain...")
    storage1, brain1 = await create_expert_brain()

    stats = await storage1.get_stats(brain1.id)
    print(f"   Created brain with {stats['neuron_count']} neurons, "
          f"{stats['synapse_count']} synapses, {stats['fiber_count']} fibers")

    # 2. Test the expert brain
    print("\n2. Testing expert brain...")
    pipeline1 = ReflexPipeline(storage1, brain1.config)

    result = await pipeline1.query("How should I format strings in Python?")
    print(f"   Query: How should I format strings in Python?")
    print(f"   Answer: {result.answer}")

    # 3. Export brain
    print("\n3. Exporting brain...")
    export_path = "python_expert_brain.json"
    await export_brain(storage1, brain1.id, export_path)

    # 4. Create new storage and import brain
    print("\n4. Importing brain into new storage...")
    storage2 = InMemoryStorage()
    imported_brain_id = await import_brain(storage2, export_path)
    storage2.set_brain(imported_brain_id)

    # 5. Test imported brain
    print("\n5. Testing imported brain...")
    brain2 = await storage2.get_brain(imported_brain_id)
    assert brain2 is not None

    pipeline2 = ReflexPipeline(storage2, brain2.config)

    queries = [
        "What should I use for testing?",
        "How to handle concurrent code?",
        "What about file paths?",
    ]

    for query in queries:
        result = await pipeline2.query(query)
        print(f"   Q: {query}")
        print(f"   A: {result.answer}")
        print()

    # 6. Verify stats match
    print("6. Verifying import...")
    stats2 = await storage2.get_stats(imported_brain_id)
    print(f"   Original: {stats['neuron_count']} neurons, "
          f"{stats['synapse_count']} synapses")
    print(f"   Imported: {stats2['neuron_count']} neurons, "
          f"{stats2['synapse_count']} synapses")

    # Cleanup
    Path(export_path).unlink(missing_ok=True)

    print("\n" + "=" * 60)
    print("Demo complete!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
