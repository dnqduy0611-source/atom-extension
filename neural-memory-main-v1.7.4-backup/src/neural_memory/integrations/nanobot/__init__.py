"""Nanobot integration for NeuralMemory.

Provides NeuralMemory tools that conform to Nanobot's Tool interface,
plus a drop-in MemoryStore replacement backed by the neural graph.

Usage::

    from neural_memory.integrations.nanobot import setup_neural_memory

    nm_store = await setup_neural_memory(registry, workspace, brain_id="my-brain")
    # Tools are now registered. nm_store can replace Nanobot's MemoryStore.
"""

from neural_memory.integrations.nanobot.context import NMContext
from neural_memory.integrations.nanobot.memory_store import NMMemoryStore
from neural_memory.integrations.nanobot.setup import setup_neural_memory
from neural_memory.integrations.nanobot.tools import (
    NMContextTool,
    NMHealthTool,
    NMRecallTool,
    NMRememberTool,
)

__all__ = [
    "NMContext",
    "NMContextTool",
    "NMHealthTool",
    "NMMemoryStore",
    "NMRecallTool",
    "NMRememberTool",
    "setup_neural_memory",
]
