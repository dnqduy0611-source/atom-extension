"""Protocol definition for external source adapters."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Protocol, runtime_checkable

from neural_memory.integration.models import (
    ExternalRecord,
    SourceCapability,
    SourceSystemType,
)


@runtime_checkable
class SourceAdapter(Protocol):
    """Protocol defining the interface for external source adapters.

    Each adapter connects to one external memory system and normalizes
    its records into ExternalRecord instances.
    """

    @property
    def system_type(self) -> SourceSystemType:
        """Category of this source system (e.g., vector_db, graph_store)."""
        ...

    @property
    def system_name(self) -> str:
        """Unique name of this source system (e.g., 'chromadb', 'mem0')."""
        ...

    @property
    def capabilities(self) -> frozenset[SourceCapability]:
        """Set of capabilities this adapter supports."""
        ...

    async def fetch_all(
        self,
        collection: str | None = None,
        limit: int | None = None,
    ) -> list[ExternalRecord]:
        """Fetch all records from the external source.

        Args:
            collection: Optional collection/namespace filter
            limit: Optional maximum number of records to fetch

        Returns:
            List of normalized ExternalRecord instances
        """
        ...

    async def fetch_since(
        self,
        since: datetime,
        collection: str | None = None,
        limit: int | None = None,
    ) -> list[ExternalRecord]:
        """Fetch records modified since a given timestamp.

        Args:
            since: Only fetch records modified after this timestamp
            collection: Optional collection/namespace filter
            limit: Optional maximum number of records to fetch

        Returns:
            List of normalized ExternalRecord instances
        """
        ...

    async def health_check(self) -> dict[str, Any]:
        """Verify connection to the external source.

        Returns:
            Dict with at least 'healthy' (bool) and 'message' (str) keys
        """
        ...
