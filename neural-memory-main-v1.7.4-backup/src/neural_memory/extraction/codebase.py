"""Python AST extractor for codebase indexing.

Parses Python source files and extracts symbols (functions, classes, methods,
imports, constants) and their relationships. Uses only stdlib ast module.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path


class CodeSymbolType(StrEnum):
    """Types of code symbols extracted from source."""

    FUNCTION = "function"
    CLASS = "class"
    METHOD = "method"
    IMPORT = "import"
    CONSTANT = "constant"


@dataclass(frozen=True)
class CodeSymbol:
    """A symbol extracted from Python source code."""

    name: str
    symbol_type: CodeSymbolType
    file_path: str
    line_start: int
    line_end: int
    signature: str | None = None
    docstring: str | None = None
    parent: str | None = None


@dataclass(frozen=True)
class CodeRelationship:
    """A relationship between code symbols."""

    source: str
    target: str
    relation: str


_SCREAMING_SNAKE = re.compile(r"^[A-Z][A-Z0-9_]+$")


def _get_end_lineno(node: ast.AST) -> int:
    """Get the end line number of an AST node."""
    return getattr(node, "end_lineno", getattr(node, "lineno", 0))


def _build_signature(node: ast.FunctionDef | ast.AsyncFunctionDef) -> str:
    """Build a function signature string from an AST node."""
    prefix = "async def" if isinstance(node, ast.AsyncFunctionDef) else "def"
    args_parts: list[str] = []

    for arg in node.args.args:
        annotation = ""
        if arg.annotation:
            annotation = f": {ast.unparse(arg.annotation)}"
        args_parts.append(f"{arg.arg}{annotation}")

    returns = ""
    if node.returns:
        returns = f" -> {ast.unparse(node.returns)}"

    return f"{prefix} {node.name}({', '.join(args_parts)}){returns}"


class PythonExtractor:
    """Extracts code symbols and relationships from Python files."""

    def extract_file(self, file_path: Path) -> tuple[list[CodeSymbol], list[CodeRelationship]]:
        """Parse a Python file and extract symbols + relationships.

        Args:
            file_path: Path to the Python file to parse.

        Returns:
            Tuple of (symbols, relationships).
        """
        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(file_path))

        file_str = str(file_path)
        symbols: list[CodeSymbol] = []
        relationships: list[CodeRelationship] = []

        for node in ast.iter_child_nodes(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                sym, rels = self._extract_function(node, file_str, parent=None)
                symbols.append(sym)
                relationships.extend(rels)

            elif isinstance(node, ast.ClassDef):
                class_syms, class_rels = self._extract_class(node, file_str)
                symbols.extend(class_syms)
                relationships.extend(class_rels)

            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                imp_syms, imp_rels = self._extract_import(node, file_str)
                symbols.extend(imp_syms)
                relationships.extend(imp_rels)

            elif isinstance(node, ast.Assign):
                const_syms, const_rels = self._extract_constant(node, file_str)
                symbols.extend(const_syms)
                relationships.extend(const_rels)

        return symbols, relationships

    def _extract_function(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        file_path: str,
        parent: str | None,
    ) -> tuple[CodeSymbol, list[CodeRelationship]]:
        """Extract a function or method symbol."""
        symbol_type = CodeSymbolType.METHOD if parent else CodeSymbolType.FUNCTION
        docstring = ast.get_docstring(node)
        signature = _build_signature(node)

        symbol = CodeSymbol(
            name=node.name,
            symbol_type=symbol_type,
            file_path=file_path,
            line_start=node.lineno,
            line_end=_get_end_lineno(node),
            signature=signature,
            docstring=docstring,
            parent=parent,
        )

        rel_target = f"{parent}.{node.name}" if parent else node.name
        relationships = [
            CodeRelationship(
                source=file_path,
                target=rel_target,
                relation="contains",
            )
        ]

        return symbol, relationships

    def _extract_class(
        self, node: ast.ClassDef, file_path: str
    ) -> tuple[list[CodeSymbol], list[CodeRelationship]]:
        """Extract a class and its methods."""
        symbols: list[CodeSymbol] = []
        relationships: list[CodeRelationship] = []

        docstring = ast.get_docstring(node)

        class_symbol = CodeSymbol(
            name=node.name,
            symbol_type=CodeSymbolType.CLASS,
            file_path=file_path,
            line_start=node.lineno,
            line_end=_get_end_lineno(node),
            docstring=docstring,
        )
        symbols.append(class_symbol)

        relationships.append(
            CodeRelationship(
                source=file_path,
                target=node.name,
                relation="contains",
            )
        )

        for base in node.bases:
            base_name = ast.unparse(base)
            relationships.append(
                CodeRelationship(
                    source=node.name,
                    target=base_name,
                    relation="is_a",
                )
            )

        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                sym, rels = self._extract_function(child, file_path, parent=node.name)
                symbols.append(sym)
                relationships.extend(rels)

        return symbols, relationships

    def _extract_import(
        self, node: ast.Import | ast.ImportFrom, file_path: str
    ) -> tuple[list[CodeSymbol], list[CodeRelationship]]:
        """Extract import symbols."""
        symbols: list[CodeSymbol] = []
        relationships: list[CodeRelationship] = []

        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.asname or alias.name
                symbols.append(
                    CodeSymbol(
                        name=name,
                        symbol_type=CodeSymbolType.IMPORT,
                        file_path=file_path,
                        line_start=node.lineno,
                        line_end=_get_end_lineno(node),
                    )
                )
                relationships.append(
                    CodeRelationship(
                        source=file_path,
                        target=alias.name,
                        relation="imports",
                    )
                )
        else:
            module = node.module or ""
            for alias in node.names:
                name = alias.asname or alias.name
                full_target = f"{module}.{alias.name}" if module else alias.name
                symbols.append(
                    CodeSymbol(
                        name=name,
                        symbol_type=CodeSymbolType.IMPORT,
                        file_path=file_path,
                        line_start=node.lineno,
                        line_end=_get_end_lineno(node),
                    )
                )
                relationships.append(
                    CodeRelationship(
                        source=file_path,
                        target=full_target,
                        relation="imports",
                    )
                )

        return symbols, relationships

    def _extract_constant(
        self, node: ast.Assign, file_path: str
    ) -> tuple[list[CodeSymbol], list[CodeRelationship]]:
        """Extract top-level constants (SCREAMING_SNAKE_CASE assignments)."""
        symbols: list[CodeSymbol] = []
        relationships: list[CodeRelationship] = []

        for target in node.targets:
            if isinstance(target, ast.Name) and _SCREAMING_SNAKE.match(target.id):
                symbols.append(
                    CodeSymbol(
                        name=target.id,
                        symbol_type=CodeSymbolType.CONSTANT,
                        file_path=file_path,
                        line_start=node.lineno,
                        line_end=_get_end_lineno(node),
                    )
                )
                relationships.append(
                    CodeRelationship(
                        source=file_path,
                        target=target.id,
                        relation="contains",
                    )
                )

        return symbols, relationships
