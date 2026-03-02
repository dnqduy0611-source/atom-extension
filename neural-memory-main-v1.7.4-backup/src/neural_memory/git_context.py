"""Git context detection utility.

Detects current git branch, commit, and repository info using subprocess.
Zero external dependencies — uses only stdlib subprocess.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class GitContext:
    """Immutable snapshot of current git repository state."""

    branch: str
    commit: str
    repo_root: str
    repo_name: str


def detect_git_context(path: Path | None = None) -> GitContext | None:
    """Detect git repo info for the given path.

    Args:
        path: Directory to check. Defaults to current working directory.

    Returns:
        GitContext if inside a git repo, None otherwise.
    """
    cwd = str(path) if path else None

    try:
        branch = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=5,
        )
        if branch.returncode != 0:
            return None

        commit = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=5,
        )
        if commit.returncode != 0:
            return None

        toplevel = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            cwd=cwd,
            timeout=5,
        )
        if toplevel.returncode != 0:
            return None

        repo_root = toplevel.stdout.strip()
        repo_name = Path(repo_root).name

        return GitContext(
            branch=branch.stdout.strip(),
            commit=commit.stdout.strip(),
            repo_root=repo_root,
            repo_name=repo_name,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
