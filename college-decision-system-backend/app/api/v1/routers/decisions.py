from decimal import Decimal

from fastapi import APIRouter, Depends

from app.api.v1.dependencies.security import verify_internal_secret
from app.api.v1.schemas.agent_decision import (
    AgentRecommendRequestSchema,
    AgentRecommendResponseSchema,
)
from app.api.v1.schemas.decision import (
    DecisionDataCompletenessSchema,
    FeeDetailsSchema,
    FeeLineItemSchema,
    ProgramRecommendationSchema,
    RecommendProgramsRequestSchema,
    RecommendProgramsResponseSchema,
)
from app.application.services.fee_category_resolver import FeeCategoryResolver
from app.application.services.training_intensity_deriver import TrainingIntensityDeriver
from app.application.services.tuition_calculator import TuitionCalculator
from app.application.use_cases.recommend_programs import (
    RecommendProgramsRequest,
    RecommendProgramsUseCase,
)
from app.infrastructure.db.repositories.decision_college_repo import DecisionCollegeRepository
from app.infrastructure.db.repositories.decision_fee_repo import DecisionFeeRepository
from app.infrastructure.db.repositories.decision_program_repo import DecisionProgramRepository
from app.infrastructure.db.session import SessionLocal


router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.post(
    "/recommend",
    response_model=AgentRecommendResponseSchema,
    summary="Recommend programs for AI Agent",
    dependencies=[Depends(verify_internal_secret)],
)
def recommend_programs(payload: AgentRecommendRequestSchema):
    db = SessionLocal()
    try:
        college_repo = DecisionCollegeRepository(db)
        program_repo = DecisionProgramRepository(db)
        fee_repo = DecisionFeeRepository(db)

        use_case = RecommendProgramsUseCase(
            college_repository=college_repo,
            program_repository=program_repo,
            fee_category_resolver=FeeCategoryResolver(
                program_repository=program_repo,
                fee_repository=fee_repo,
            ),
            tuition_calculator=TuitionCalculator(fee_repository=fee_repo),
            training_intensity_deriver=TrainingIntensityDeriver(),
        )

        all_interests = payload.preferences.interests + payload.preferences.career_goals

        result = use_case.execute(
            RecommendProgramsRequest(
                certificate_type=payload.student_profile.certificate_type,
                high_school_percentage=(
                    Decimal(str(payload.student_profile.high_school_percentage))
                    if payload.student_profile.high_school_percentage is not None
                    else None
                ),
                student_group="other_states",  # Default if missing
                budget=(
                    Decimal(str(payload.student_profile.budget))
                    if payload.student_profile.budget is not None
                    else None
                ),
                preferred_branch=None,
                preferred_city=None,
                interests=list(set(all_interests)),
                track_type=payload.student_profile.track_type,
                max_results=5,
                min_results=3,
            )
        )

        if not result.recommendations:
            return AgentRecommendResponseSchema(
                recommended_major="None",
                confidence=0.0,
                reason="No programs found matching the given criteria.",
                score_breakdown={},
                warnings=["Consider broadening your interests or increasing your budget."]
            )

        top_match = result.recommendations[0]

        return AgentRecommendResponseSchema(
            recommended_major=top_match.program_name,
            confidence=float(top_match.score),
            reason=top_match.explanation_summary,
            score_breakdown=top_match.score_breakdown,
            warnings=top_match.warnings
        )
    finally:
        db.close()


def _serialize_decimal(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _serialize_fee_lines(lines) -> list[FeeLineItemSchema]:
    return [
        FeeLineItemSchema(
            fee_type=line.fee_type,
            amount=float(line.amount),
            frequency=line.frequency,
            note=line.note,
        )
        for line in lines
    ]
