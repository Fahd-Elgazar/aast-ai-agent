"""Executable local gate for all RAG relevance, abstention, and readiness tests."""

import sys
import unittest
from pathlib import Path


def main() -> int:
    test_root = Path(__file__).resolve().parent
    suite = unittest.defaultTestLoader.discover(
        start_dir=str(test_root),
        pattern="test_*.py",
        top_level_dir=str(test_root),
    )
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main())
