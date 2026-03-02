"""Tests for Mem0 adapters and shared parsing logic."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from neural_memory.integration.adapters.mem0_adapter import _parse_mem0_records
from neural_memory.integration.models import SourceCapability, SourceSystemType

# ========== _parse_mem0_records tests ==========


class TestParseMem0Records:
    def test_empty_list(self) -> None:
        records = _parse_mem0_records(
            [], source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert records == []

    def test_dict_with_results_key(self) -> None:
        data = {"results": [{"id": "1", "memory": "Hello"}]}
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert len(records) == 1
        assert records[0].content == "Hello"

    def test_text_fallback(self) -> None:
        """Test that 'text' field is used when 'memory' is empty."""
        data = [{"id": "1", "text": "Fallback content"}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert len(records) == 1
        assert records[0].content == "Fallback content"

    def test_empty_content_skipped(self) -> None:
        data = [{"id": "1", "memory": ""}, {"id": "2", "memory": "Valid"}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert len(records) == 1

    def test_limit_none_returns_all(self) -> None:
        data = [{"id": str(i), "memory": f"Mem {i}"} for i in range(20)]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert len(records) == 20

    def test_limit_zero_returns_none(self) -> None:
        """limit=0 should return empty list (not bypass check)."""
        data = [{"id": "1", "memory": "Hello"}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=0
        )
        assert len(records) == 0

    def test_limit_applied(self) -> None:
        data = [{"id": str(i), "memory": f"Mem {i}"} for i in range(10)]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=3
        )
        assert len(records) == 3

    def test_user_id_tag(self) -> None:
        data = [{"id": "1", "memory": "Test"}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id="alice", agent_id=None, limit=None
        )
        assert "user:alice" in records[0].tags

    def test_agent_id_tag(self) -> None:
        data = [{"id": "1", "memory": "Test"}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id="bot-1", limit=None
        )
        assert "agent:bot-1" in records[0].tags

    def test_categories_as_tags(self) -> None:
        data = [{"id": "1", "memory": "Test", "categories": ["python", "async"]}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert "python" in records[0].tags
        assert "async" in records[0].tags

    def test_categories_tag_length_limit(self) -> None:
        """Tags longer than 100 chars should be filtered out."""
        long_tag = "x" * 101
        data = [{"id": "1", "memory": "Test", "categories": [long_tag, "valid"]}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert long_tag not in records[0].tags
        assert "valid" in records[0].tags

    def test_categories_tag_count_limit(self) -> None:
        """No more than 50 category tags should be kept."""
        data = [{"id": "1", "memory": "Test", "categories": [f"cat-{i}" for i in range(60)]}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        # May have user/agent tags too, but category tags capped at 50
        cat_tags = [t for t in records[0].tags if t.startswith("cat-")]
        assert len(cat_tags) == 50

    def test_malformed_created_at_uses_default(self) -> None:
        data = [{"id": "1", "memory": "Test", "created_at": "not-a-date"}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert len(records) == 1
        # Should not raise, uses utcnow() as fallback

    def test_valid_created_at_parsed(self) -> None:
        data = [{"id": "1", "memory": "Test", "created_at": "2026-01-15T10:00:00Z"}]
        records = _parse_mem0_records(
            data, source_system="mem0", user_id=None, agent_id=None, limit=None
        )
        assert records[0].created_at.year == 2026
        assert records[0].created_at.month == 1

    def test_source_system_propagated(self) -> None:
        data = [{"id": "1", "memory": "Test"}]
        records = _parse_mem0_records(
            data, source_system="mem0_self_hosted", user_id=None, agent_id=None, limit=None
        )
        assert records[0].source_system == "mem0_self_hosted"


# ========== Mem0SelfHostedAdapter tests ==========


class TestMem0SelfHostedAdapter:
    def _make_adapter(self, **kwargs: Any) -> Any:
        from neural_memory.integration.adapters.mem0_adapter import (
            Mem0SelfHostedAdapter,
        )

        return Mem0SelfHostedAdapter(**kwargs)

    def test_system_name(self) -> None:
        adapter = self._make_adapter()
        assert adapter.system_name == "mem0_self_hosted"

    def test_system_type(self) -> None:
        adapter = self._make_adapter()
        assert adapter.system_type == SourceSystemType.MEMORY_LAYER

    def test_capabilities(self) -> None:
        adapter = self._make_adapter()
        caps = adapter.capabilities
        assert SourceCapability.FETCH_ALL in caps
        assert SourceCapability.FETCH_METADATA in caps
        assert SourceCapability.HEALTH_CHECK in caps
        assert SourceCapability.FETCH_SINCE not in caps

    @pytest.mark.asyncio
    async def test_fetch_all_empty(self) -> None:
        adapter = self._make_adapter(user_id="test")
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(return_value=[])
        adapter._client = mock_client

        records = await adapter.fetch_all()
        assert records == []
        mock_client.get_all.assert_called_once()

    @pytest.mark.asyncio
    async def test_fetch_all_with_memories(self) -> None:
        adapter = self._make_adapter(user_id="alice")
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(
            return_value=[
                {
                    "id": "mem-1",
                    "memory": "Python is great",
                    "metadata": {"type": "fact"},
                    "created_at": "2026-01-15T10:00:00Z",
                },
                {
                    "id": "mem-2",
                    "memory": "Use async/await",
                    "metadata": {},
                },
            ]
        )
        adapter._client = mock_client

        records = await adapter.fetch_all()
        assert len(records) == 2
        assert records[0].content == "Python is great"
        assert records[0].source_system == "mem0_self_hosted"
        assert records[0].id == "mem-1"
        assert "user:alice" in records[0].tags
        assert records[1].content == "Use async/await"

    @pytest.mark.asyncio
    async def test_fetch_all_with_limit(self) -> None:
        adapter = self._make_adapter()
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(
            return_value=[{"id": f"mem-{i}", "memory": f"Memory {i}"} for i in range(10)]
        )
        adapter._client = mock_client

        records = await adapter.fetch_all(limit=3)
        assert len(records) == 3

    @pytest.mark.asyncio
    async def test_fetch_all_skips_empty_content(self) -> None:
        adapter = self._make_adapter()
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(
            return_value=[
                {"id": "mem-1", "memory": ""},
                {"id": "mem-2", "memory": "Valid content"},
            ]
        )
        adapter._client = mock_client

        records = await adapter.fetch_all()
        assert len(records) == 1
        assert records[0].content == "Valid content"

    @pytest.mark.asyncio
    async def test_fetch_all_dict_response(self) -> None:
        """Test when Mem0 returns a dict with 'results' key."""
        adapter = self._make_adapter()
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(return_value={"results": [{"id": "m1", "memory": "Hello"}]})
        adapter._client = mock_client

        records = await adapter.fetch_all()
        assert len(records) == 1

    @pytest.mark.asyncio
    async def test_fetch_all_with_agent_id(self) -> None:
        adapter = self._make_adapter(agent_id="agent-1")
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(return_value=[{"id": "m1", "memory": "test"}])
        adapter._client = mock_client

        records = await adapter.fetch_all()
        assert len(records) == 1
        assert "agent:agent-1" in records[0].tags
        mock_client.get_all.assert_called_once_with(agent_id="agent-1")

    @pytest.mark.asyncio
    async def test_fetch_since_not_implemented(self) -> None:
        adapter = self._make_adapter()
        with pytest.raises(NotImplementedError):
            await adapter.fetch_since(since=datetime.now())

    @pytest.mark.asyncio
    async def test_health_check_healthy(self) -> None:
        adapter = self._make_adapter(user_id="test")
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(return_value=[])
        adapter._client = mock_client

        result = await adapter.health_check()
        assert result["healthy"] is True
        assert result["system"] == "mem0_self_hosted"

    @pytest.mark.asyncio
    async def test_health_check_unhealthy(self) -> None:
        adapter = self._make_adapter()
        mock_client = MagicMock()
        mock_client.get_all = MagicMock(side_effect=ConnectionError("timeout"))
        adapter._client = mock_client

        result = await adapter.health_check()
        assert result["healthy"] is False
        assert "connection failed" in result["message"].lower()

    def test_lazy_init_default(self) -> None:
        """Test that _get_client creates Memory() by default."""
        mock_memory_cls = MagicMock()
        mock_memory_cls.return_value = MagicMock()
        with patch.dict("sys.modules", {"mem0": MagicMock(Memory=mock_memory_cls)}):
            # Clear cached client to force re-init
            adapter = self._make_adapter()
            client = adapter._get_client()
            mock_memory_cls.assert_called_once_with()
            assert client is not None

    def test_lazy_init_with_config(self) -> None:
        """Test that _get_client uses from_config when config provided."""
        mock_instance = MagicMock()
        mock_memory_cls = MagicMock()
        mock_memory_cls.from_config = MagicMock(return_value=mock_instance)
        with patch.dict("sys.modules", {"mem0": MagicMock(Memory=mock_memory_cls)}):
            adapter = self._make_adapter(config={"llm": {"provider": "openai"}})
            client = adapter._get_client()
            mock_memory_cls.from_config.assert_called_once_with({"llm": {"provider": "openai"}})
            assert client is mock_instance


# ========== Adapter registry tests ==========


class TestAdapterRegistry:
    def test_mem0_self_hosted_in_list(self) -> None:
        from neural_memory.integration.adapters import list_adapters

        adapters = list_adapters()
        assert "mem0_self_hosted" in adapters

    def test_lazy_load_self_hosted(self) -> None:
        with patch("neural_memory.integration.adapters.mem0_adapter.Mem0SelfHostedAdapter"):
            from neural_memory.integration.adapters import _lazy_load_adapter

            cls = _lazy_load_adapter("mem0_self_hosted")
            assert cls is not None
