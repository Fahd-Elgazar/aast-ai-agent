"""Seed only the migrated conference Decision database."""
import runpy

from app.infrastructure.db.session import SessionLocal
from app.infrastructure.db.models import DecisionCollegeModel, DecisionProgramModel

fixture = runpy.run_path("/run/iccta/decision_seed.py")
expected_programs = {str(row["program_id"]) for row in fixture["SYNTHETIC_PROGRAMS"]}
expected_colleges = {str(row["college_id"]) for row in fixture["SYNTHETIC_PROGRAMS"]}

with SessionLocal() as session:
    actual_programs = {row.id for row in session.query(DecisionProgramModel).all()}
    actual_colleges = {row.id for row in session.query(DecisionCollegeModel).all()}
    if not actual_programs and not actual_colleges:
        fixture["seed_synthetic_decision_data"](session)
    elif actual_programs != expected_programs or actual_colleges != expected_colleges:
        raise SystemExit("Existing Decision data do not match the synthetic conference fixture.")
print("PASS synthetic Decision fixture")
