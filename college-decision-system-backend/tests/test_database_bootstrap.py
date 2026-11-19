from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine

from app.infrastructure.db import models  # noqa: F401
from app.infrastructure.db.session import Base


ROOT_DIR = Path(__file__).resolve().parents[1]
HEAD_REVISION = "4a4dbd1d4c6c"
PRIOR_REVISION = "1c26e9f9d3c2"


def _database_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


def _run(
    args: list[str],
    database_path: Path,
    *,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    environment = os.environ.copy()
    environment["DATABASE_URL"] = _database_url(database_path)
    return subprocess.run(
        args,
        cwd=ROOT_DIR,
        env=environment,
        check=check,
        capture_output=True,
        text=True,
    )


def _bootstrap(database_path: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return _run(
        [sys.executable, "scripts/bootstrap_database.py"],
        database_path,
        check=check,
    )


def _revision(database_path: Path) -> str | None:
    with sqlite3.connect(database_path) as connection:
        try:
            row = connection.execute("SELECT version_num FROM alembic_version").fetchone()
        except sqlite3.OperationalError:
            return None
    return row[0] if row else None


def _columns(database_path: Path, table: str) -> set[str]:
    with sqlite3.connect(database_path) as connection:
        rows = connection.execute(f'PRAGMA table_info("{table}")').fetchall()
    return {row[1] for row in rows}


def test_bootstrap_creates_and_migrates_fresh_database(tmp_path: Path) -> None:
    database_path = tmp_path / "fresh.db"

    result = _bootstrap(database_path)

    assert result.returncode == 0
    assert _revision(database_path) == HEAD_REVISION
    assert {"min_percentage", "allowed_tracks", "program_fees"} <= _columns(
        database_path, "decision_programs"
    )


def test_bootstrap_upgrades_versioned_existing_database(tmp_path: Path) -> None:
    database_path = tmp_path / "existing.db"
    _run(
        [sys.executable, "-m", "alembic", "upgrade", PRIOR_REVISION],
        database_path,
    )
    assert _revision(database_path) == PRIOR_REVISION

    _bootstrap(database_path)

    assert _revision(database_path) == HEAD_REVISION
    assert {"min_percentage", "allowed_tracks", "program_fees"} <= _columns(
        database_path, "decision_programs"
    )


def test_bootstrap_stamps_exact_unversioned_head_without_data_loss(tmp_path: Path) -> None:
    database_path = tmp_path / "bundled.db"
    engine = create_engine(_database_url(database_path), future=True)
    Base.metadata.create_all(engine)
    engine.dispose()
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "INSERT INTO chat_messages "
            "(id, session_id, role, content, tool_calls, created_at) "
            "VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
            ("preserved", "session", "user", "keep me", None),
        )
        connection.commit()
    assert _revision(database_path) is None

    result = _bootstrap(database_path)

    assert "stamping" in result.stdout
    assert _revision(database_path) == HEAD_REVISION
    with sqlite3.connect(database_path) as connection:
        preserved = connection.execute(
            "SELECT content FROM chat_messages WHERE id = ?", ("preserved",)
        ).fetchone()
    assert preserved == ("keep me",)


def test_bootstrap_refuses_unknown_unversioned_schema_without_mutation(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "unknown.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute("CREATE TABLE decision_colleges (id TEXT PRIMARY KEY)")
        connection.execute("INSERT INTO decision_colleges (id) VALUES ('preserved')")
        connection.commit()

    result = _bootstrap(database_path, check=False)

    assert result.returncode != 0
    assert "refusing to stamp or migrate" in result.stderr
    with sqlite3.connect(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        preserved = connection.execute("SELECT id FROM decision_colleges").fetchone()
    assert "alembic_version" not in tables
    assert preserved == ("preserved",)
