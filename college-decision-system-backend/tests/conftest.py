from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest


TEST_TEMP_DIR = Path(tempfile.mkdtemp(prefix="aast-decision-pytest-")).resolve()
TEST_DATABASE_PATH = TEST_TEMP_DIR / "decision-tests.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE_PATH.as_posix()}"

# These imports must remain after DATABASE_URL is assigned. The application creates
# its process-global SQLAlchemy engine while importing the session module.
from app.infrastructure.db.session import SessionLocal, engine  # noqa: E402
from scripts.bootstrap_database import bootstrap_database  # noqa: E402
from tests.fixtures.decision_seed import seed_synthetic_decision_data  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def isolated_migrated_decision_database() -> None:
    """Run every test against a fresh migrated database with synthetic data."""

    try:
        bootstrap_database()
        with SessionLocal() as session:
            seed_synthetic_decision_data(session)
        yield
    finally:
        engine.dispose()
        shutil.rmtree(TEST_TEMP_DIR, ignore_errors=True)
