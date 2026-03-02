"""Extraction modules for parsing queries and content."""

from neural_memory.extraction.entities import Entity, EntityExtractor
from neural_memory.extraction.parser import (
    Perspective,
    QueryIntent,
    QueryParser,
    Stimulus,
)
from neural_memory.extraction.relations import (
    RelationCandidate,
    RelationExtractor,
    RelationType,
)
from neural_memory.extraction.router import (
    QueryRouter,
    QueryType,
    RouteConfidence,
    RouteDecision,
    route_query,
)
from neural_memory.extraction.temporal import (
    TemporalExtractor,
    TimeGranularity,
    TimeHint,
)

__all__ = [
    # Temporal
    "TimeHint",
    "TimeGranularity",
    "TemporalExtractor",
    # Parser
    "Stimulus",
    "QueryIntent",
    "Perspective",
    "QueryParser",
    # Router (MemoCore integration)
    "QueryRouter",
    "QueryType",
    "RouteConfidence",
    "RouteDecision",
    "route_query",
    # Entities
    "Entity",
    "EntityExtractor",
    # Relations
    "RelationCandidate",
    "RelationExtractor",
    "RelationType",
]
