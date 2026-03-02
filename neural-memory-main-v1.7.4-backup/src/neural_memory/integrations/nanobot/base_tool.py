"""Base class for NeuralMemory tools in Nanobot."""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

from neural_memory.integrations.nanobot.context import NMContext


class BaseNMTool(ABC):
    """Base class for NM tools conforming to Nanobot's Tool interface.

    Subclasses implement ``name``, ``description``, ``parameters``, ``execute``.
    """

    def __init__(self, ctx: NMContext) -> None:
        self._ctx = ctx

    @property
    @abstractmethod
    def name(self) -> str: ...

    @property
    @abstractmethod
    def description(self) -> str: ...

    @property
    @abstractmethod
    def parameters(self) -> dict[str, Any]: ...

    @abstractmethod
    async def execute(self, **kwargs: Any) -> str: ...

    def to_schema(self) -> dict[str, Any]:
        """Return tool definition in OpenAI function-calling format."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }

    def validate_params(self, params: dict[str, Any]) -> list[str]:
        """Validate parameters against JSON schema (basic check)."""
        errors: list[str] = []
        required = self.parameters.get("required", [])
        for key in required:
            if key not in params:
                errors.append(f"Missing required parameter: {key}")
        return errors

    def _json(self, data: dict[str, Any]) -> str:
        """Serialize response to JSON string."""
        return json.dumps(data, default=str, ensure_ascii=False)
