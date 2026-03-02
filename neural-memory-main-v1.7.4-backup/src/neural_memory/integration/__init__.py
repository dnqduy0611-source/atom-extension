"""External source integration layer for NeuralMemory.

Import memories from competing systems (ChromaDB, Mem0, Graphiti, etc.)
into NeuralMemory's neuron/synapse/fiber graph.
"""

from neural_memory.integration.adapter import SourceAdapter
from neural_memory.integration.mapper import MappingResult, RecordMapper
from neural_memory.integration.models import (
    ExternalRecord,
    ExternalRelationship,
    ImportResult,
    SourceCapability,
    SourceSystemType,
    SyncState,
)
from neural_memory.integration.sync_engine import SyncEngine

__all__ = [
    "ExternalRecord",
    "ExternalRelationship",
    "ImportResult",
    "MappingResult",
    "RecordMapper",
    "SourceAdapter",
    "SourceCapability",
    "SourceSystemType",
    "SyncEngine",
    "SyncState",
]
