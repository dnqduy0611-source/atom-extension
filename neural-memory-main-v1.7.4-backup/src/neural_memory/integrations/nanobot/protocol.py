"""Protocol definitions matching Nanobot's Tool ABC.

Avoids requiring nanobot as a dependency while ensuring structural
compatibility with ``nanobot.agent.tools.base.Tool``.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class NanobotTool(Protocol):
    """Structural protocol matching nanobot's Tool abstract base class."""

    @property
    def name(self) -> str: ...

    @property
    def description(self) -> str: ...

    @property
    def parameters(self) -> dict[str, Any]: ...

    async def execute(self, **kwargs: Any) -> str: ...

    def to_schema(self) -> dict[str, Any]: ...


@runtime_checkable
class NanobotToolRegistry(Protocol):
    """Structural protocol matching nanobot's ToolRegistry.register()."""

    def register(self, tool: Any) -> None: ...
