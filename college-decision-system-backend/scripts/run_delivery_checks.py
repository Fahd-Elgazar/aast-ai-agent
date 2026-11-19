from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

def run_command(args: list[str]) -> None:
    print(f"$ {' '.join(args)}", flush=True)
    subprocess.run(args, cwd=ROOT_DIR, check=True)


def run_smoke_checks() -> None:
    # Import only after main() has selected the isolated delivery database.
    from app.main import app

    cases = [
        (
            "ai_budgeted",
            {
                "certificate_type": "Egyptian Thanaweya Amma (Science)",
                "high_school_percentage": 85,
                "student_group": "other_states",
                "budget": 5000,
                "interests": ["AI"],
                "track_type": "regular",
                "max_results": 1,
            },
        ),
        (
            "budget_sensitive",
            {
                "certificate_type": "Egyptian Thanaweya Amma (Science)",
                "high_school_percentage": 85,
                "student_group": "other_states",
                "budget": 2200,
                "interests": ["business"],
                "track_type": "regular",
                "max_results": 1,
            },
        ),
        (
            "incomplete_data",
            {
                "certificate_type": "Egyptian Thanaweya Amma (Science)",
                "high_school_percentage": 85,
                "student_group": "other_states",
                "budget": 5000,
                "interests": ["logistics"],
                "preferred_city": "El Alamein",
                "track_type": "regular",
                "max_results": 1,
            },
        ),
        (
            "unknown_fee",
            {
                "certificate_type": "Egyptian Thanaweya Amma (Math)",
                "high_school_percentage": 85,
                "student_group": "other_states",
                "budget": 7000,
                "interests": ["engineering"],
                "preferred_city": "New Alamein",
                "track_type": "regular",
                "max_results": 1,
            },
        ),
    ]

    with TestClient(app) as client:
        for name, payload in cases:
            response = client.post("/api/v1/decisions/recommend", json=payload)
            response.raise_for_status()
            body = response.json()
            assert body["recommendations"], f"{name}: expected at least one recommendation"
            top = body["recommendations"][0]
            print(
                json.dumps(
                    {
                        "case": name,
                        "program_id": top["program_id"],
                        "score": top["score"],
                        "estimated_semester_fee": top["estimated_semester_fee"],
                        "tuition_unavailable": top["tuition_unavailable"],
                        "warnings": top["warnings"][:3],
                    },
                    indent=2,
                )
            )


def seed_delivery_database() -> None:
    # These imports intentionally happen after DATABASE_URL is assigned in main().
    from app.infrastructure.db.session import SessionLocal
    from tests.fixtures.decision_seed import seed_synthetic_decision_data

    with SessionLocal() as session:
        seed_synthetic_decision_data(session)


def main() -> int:
    original_database_url = os.environ.get("DATABASE_URL")
    with tempfile.TemporaryDirectory(prefix="aast-decision-delivery-") as temp_dir:
        database_path = (Path(temp_dir) / "delivery-checks.db").resolve()
        os.environ["DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"

        try:
            run_command([sys.executable, "scripts/bootstrap_database.py"])
            seed_delivery_database()
            run_command([sys.executable, "-m", "pytest", "tests/", "-q"])
            run_command(
                [
                    sys.executable,
                    "scripts/audit_decision_db_integrity.py",
                    "--format",
                    "text",
                ]
            )
            run_smoke_checks()
        finally:
            session_module = sys.modules.get("app.infrastructure.db.session")
            if session_module is not None:
                session_module.engine.dispose()

            if original_database_url is None:
                os.environ.pop("DATABASE_URL", None)
            else:
                os.environ["DATABASE_URL"] = original_database_url

    print("Hermetic delivery checks completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
