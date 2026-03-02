"""Tests for SQLiteSyncStateMixin (sync state persistence)."""

from __future__ import annotations

import tempfile
from datetime import UTC, datetime
from pathlib import Path

import pytest

from neural_memory.core.brain import Brain
from neural_memory.integration.models import SyncState
from neural_memory.storage.sqlite_store import SQLiteStorage


@pytest.fixture
async def storage() -> SQLiteStorage:
    """Create a temporary SQLite storage."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        storage = SQLiteStorage(db_path)
        await storage.initialize()

        brain = Brain.create(name="test_brain")
        await storage.save_brain(brain)
        storage.set_brain(brain.id)

        yield storage

        await storage.close()


class TestSyncStatePersistence:
    @pytest.mark.asyncio
    async def test_get_sync_state_not_found(self, storage: SQLiteStorage) -> None:
        result = await storage.get_sync_state("mem0", "default")
        assert result is None

    @pytest.mark.asyncio
    async def test_save_and_get_sync_state(self, storage: SQLiteStorage) -> None:
        now = datetime.now(UTC)
        state = SyncState(
            source_system="mem0",
            source_collection="alice",
            last_sync_at=now,
            records_imported=42,
            last_record_id="rec-99",
            metadata={"version": "1.0"},
        )
        await storage.save_sync_state(state)

        loaded = await storage.get_sync_state("mem0", "alice")
        assert loaded is not None
        assert loaded.source_system == "mem0"
        assert loaded.source_collection == "alice"
        assert loaded.records_imported == 42
        assert loaded.last_record_id == "rec-99"
        assert loaded.metadata == {"version": "1.0"}
        assert loaded.last_sync_at is not None

    @pytest.mark.asyncio
    async def test_upsert_sync_state(self, storage: SQLiteStorage) -> None:
        """INSERT OR REPLACE should update existing row."""
        state1 = SyncState(
            source_system="mem0",
            source_collection="default",
            records_imported=10,
        )
        await storage.save_sync_state(state1)

        state2 = SyncState(
            source_system="mem0",
            source_collection="default",
            records_imported=25,
            last_record_id="rec-50",
        )
        await storage.save_sync_state(state2)

        loaded = await storage.get_sync_state("mem0", "default")
        assert loaded is not None
        assert loaded.records_imported == 25
        assert loaded.last_record_id == "rec-50"

    @pytest.mark.asyncio
    async def test_different_sources_independent(self, storage: SQLiteStorage) -> None:
        state_a = SyncState(source_system="mem0", source_collection="default", records_imported=5)
        state_b = SyncState(
            source_system="mem0_self_hosted", source_collection="default", records_imported=10
        )
        await storage.save_sync_state(state_a)
        await storage.save_sync_state(state_b)

        loaded_a = await storage.get_sync_state("mem0", "default")
        loaded_b = await storage.get_sync_state("mem0_self_hosted", "default")
        assert loaded_a is not None
        assert loaded_b is not None
        assert loaded_a.records_imported == 5
        assert loaded_b.records_imported == 10

    @pytest.mark.asyncio
    async def test_null_last_sync_at(self, storage: SQLiteStorage) -> None:
        """Sync state with no last_sync_at should load as None."""
        state = SyncState(
            source_system="mem0",
            source_collection="default",
            last_sync_at=None,
            records_imported=0,
        )
        await storage.save_sync_state(state)

        loaded = await storage.get_sync_state("mem0", "default")
        assert loaded is not None
        assert loaded.last_sync_at is None

    @pytest.mark.asyncio
    async def test_empty_metadata(self, storage: SQLiteStorage) -> None:
        state = SyncState(
            source_system="mem0",
            source_collection="default",
            metadata={},
        )
        await storage.save_sync_state(state)

        loaded = await storage.get_sync_state("mem0", "default")
        assert loaded is not None
        assert loaded.metadata == {}

    @pytest.mark.asyncio
    async def test_clear_removes_sync_states(self, storage: SQLiteStorage) -> None:
        """Sync states should be deleted when brain is cleared."""
        state = SyncState(
            source_system="mem0",
            source_collection="default",
            records_imported=10,
        )
        await storage.save_sync_state(state)

        brain_id = storage._get_brain_id()
        await storage.clear(brain_id)

        loaded = await storage.get_sync_state("mem0", "default")
        assert loaded is None
