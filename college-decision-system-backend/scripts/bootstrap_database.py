from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect

ROOT_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = ROOT_DIR / "alembic.ini"
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.infrastructure.db import models  # noqa: E402,F401
from app.infrastructure.db.session import Base  # noqa: E402


class UnsafeUnversionedSchemaError(RuntimeError):
    """Raised when an unversioned database is not exactly the current schema."""


def _alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI))
    database_url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    if not database_url:
        raise RuntimeError("DATABASE_URL and sqlalchemy.url are both unset")
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def _difference_label(difference: Any) -> str:
    if isinstance(difference, tuple) and difference:
        return str(difference[0])
    return type(difference).__name__


def _validate_unversioned_head_schema(connection) -> None:  # type: ignore[no-untyped-def]
    context = MigrationContext.configure(
        connection,
        opts={
            "compare_type": True,
            "compare_server_default": True,
        },
    )
    differences = compare_metadata(context, Base.metadata)
    if not differences:
        return

    labels = sorted({_difference_label(difference) for difference in differences})
    raise UnsafeUnversionedSchemaError(
        "Unversioned database schema does not exactly match the current model; "
        "refusing to stamp or migrate it automatically. "
        f"Detected {len(differences)} schema difference(s): {', '.join(labels)}"
    )


def bootstrap_database() -> str:
    """Safely bring the configured database to the single Alembic head."""

    config = _alembic_config()
    database_url = config.get_main_option("sqlalchemy.url")
    script = ScriptDirectory.from_config(config)
    expected_heads = tuple(script.get_heads())
    if len(expected_heads) != 1:
        raise RuntimeError(f"Expected one Alembic head, found {expected_heads!r}")

    engine = create_engine(database_url, future=True)
    should_stamp_head = False
    try:
        with engine.connect() as connection:
            migration_context = MigrationContext.configure(connection)
            current_heads = tuple(migration_context.get_current_heads())
            user_tables = set(inspect(connection).get_table_names()) - {"alembic_version"}

            if not current_heads and user_tables:
                _validate_unversioned_head_schema(connection)
                should_stamp_head = True
    finally:
        engine.dispose()

    if should_stamp_head:
        print(
            "[DB_BOOTSTRAP] Unversioned schema exactly matches the current model; "
            f"stamping {expected_heads[0]} without replaying destructive DDL.",
            flush=True,
        )
        command.stamp(config, "head")

    command.upgrade(config, "head")

    verification_engine = create_engine(database_url, future=True)
    try:
        with verification_engine.connect() as connection:
            actual_heads = tuple(MigrationContext.configure(connection).get_current_heads())
    finally:
        verification_engine.dispose()

    if actual_heads != expected_heads:
        raise RuntimeError(
            f"Database bootstrap ended at {actual_heads!r}; expected {expected_heads!r}"
        )

    print(f"[DB_BOOTSTRAP] Database ready at {expected_heads[0]}.", flush=True)
    return expected_heads[0]


def main() -> int:
    bootstrap_database()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
