"""Shared pytest fixtures for amo-stories-engine tests."""

import sys
from pathlib import Path

# Ensure app package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
