from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.infrastructure.db.session import SessionLocal
from app.infrastructure.db.models.decision_program import DecisionProgramModel
from pydantic import BaseModel, ConfigDict, Field, model_validator
from decimal import Decimal
from app.api.v1.dependencies.security import require_admin

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ProgramUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    min_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    program_fees: Decimal | None = Field(default=None, ge=0)
    allowed_tracks: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def require_at_least_one_update(self) -> "ProgramUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one program field must be supplied")
        return self


def serialize_program(program: DecisionProgramModel) -> dict[str, object]:
    return {
        "id": program.id,
        "program_name": program.program_name,
        "college_id": program.college_id,
        "min_percentage": (
            float(program.min_percentage) if program.min_percentage is not None else None
        ),
        "program_fees": float(program.program_fees) if program.program_fees is not None else None,
        "allowed_tracks": program.allowed_tracks,
    }

@router.get("/programs")
def get_programs(db: Session = Depends(get_db)):
    programs = (
        db.query(DecisionProgramModel)
        .order_by(DecisionProgramModel.college_id, DecisionProgramModel.program_name)
        .all()
    )
    return [serialize_program(program) for program in programs]

@router.put("/programs/{program_id}")
def update_program(program_id: str, request: ProgramUpdateRequest, db: Session = Depends(get_db)):
    program = db.query(DecisionProgramModel).filter(DecisionProgramModel.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    for field_name in request.model_fields_set:
        setattr(program, field_name, getattr(request, field_name))

    try:
        db.commit()
        db.refresh(program)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Program update failed") from exc

    return {"status": "success", "program": serialize_program(program)}
