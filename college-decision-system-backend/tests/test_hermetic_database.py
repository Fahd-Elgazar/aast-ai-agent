from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text

from app.infrastructure.db.models.decision_college import DecisionCollegeModel
from app.infrastructure.db.models.decision_program import DecisionProgramModel
from app.infrastructure.db.session import SessionLocal, engine


ROOT_DIR = Path(__file__).resolve().parents[1]


def test_test_suite_uses_isolated_migrated_synthetic_database() -> None:
    configured_database = Path(str(engine.url.database)).resolve()
    private_database = (ROOT_DIR / "dev.db").resolve()

    assert configured_database != private_database
    assert "aast-decision-pytest-" in str(configured_database.parent)

    script = ScriptDirectory.from_config(Config(str(ROOT_DIR / "alembic.ini")))
    expected_heads = tuple(script.get_heads())
    assert len(expected_heads) == 1

    with SessionLocal() as session:
        actual_head = session.execute(text("select version_num from alembic_version")).scalar_one()
        assert actual_head == expected_heads[0]
        assert session.query(DecisionCollegeModel).count() == 3
        assert session.query(DecisionProgramModel).count() == 3
